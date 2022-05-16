require('./trace.js');
let fs = require('fs');

class Analyzer {
    constructor(dirPath, tracePath) {
        this.model = null;
        this.slowRendering = {};
        this.frozenFrames = {};
        this.alerts = {};
        this.cpus = [];
        this.frames = [];
        this.frameCount = 0;

        this.FRAME_INTERVAL = 16.67;
        this.FROZEN_INTERVAL = 700;

        this.TRACE_HEADER = "<script class=\"trace-data\" type=\"application/text\">";
        this.TRACE_FOOTER = "  </script>";

        this.timeLineFileName = "timeLine.json";

        // let files = fs.readdirSync(this.traceDir);
        this.timeLine = JSON.parse(fs.readFileSync(dirPath + '/' + this.timeLineFileName, "utf-8"));
        this.loadModel(tracePath);
        // for (let idx in files) {
        //     if (!files.hasOwnProperty(idx)) continue;
        //     if (files[idx].indexOf(".html") > -1) {
        //         this.model = undefined;
        //         console.log(`Analyzing ${files[idx]}...`);
        //         this.loadModel(`${traceDir}/${files[idx]}`);
        //     }
        // }

        this.logResults();
    }

    loadModel(fileName) {
        let traces = this.loadSingleTraceFile(fileName);

        const m = new tr.Model();
        let i = new tr.importer.Import(m);
        i.importTraces(traces);
        this.model = m;
        this.cpus = [];
        this.collectCPUSpecs();
        this.analyzeAppFrames();
    }

    loadSingleTraceFile(fileName) {
        let fileContent = fs.readFileSync(fileName, 'utf-8');
        let traces = [];

        let headerPos = fileContent.indexOf(this.TRACE_HEADER);
        while (headerPos > -1) {
            let footerPos = fileContent.indexOf(this.TRACE_FOOTER, headerPos + 1);
            if (footerPos === -1) break;
            traces.push(fileContent.substring(headerPos + this.TRACE_HEADER.length, footerPos).substring(1));
            headerPos = fileContent.indexOf(this.TRACE_HEADER, footerPos + 1);
        }

        if (traces.length !== 3) {
            throw new Error("Invalid number of trace data");
        } else return traces;
    }

    analyzeAppFrames() {
        // find all processes with frames being rendered
        let appProcesses = [];
        let keys = Object.keys(this.model.processes);
        for (let index in keys) {
            let key = keys[index];
            let processFrames = this.model.processes[key].frames;
            if (processFrames.length > 0)
                appProcesses.push(this.model.processes[key])
        }

        appProcesses.forEach((process) => {
            this.frameCount += process.frames.length;
        });

        // find processes with slow rendering
        this.findProcessesWith("slow", appProcesses);
        // find processes with frozen frames
        this.findProcessesWith("frozen", appProcesses);

        this.collectAlerts();
    }

    findProcessesWith(type, appProcesses) {
        let frames;
        let interval;
        let max;
        if (type === "slow") {
            frames = this.slowRendering;
            interval = this.FRAME_INTERVAL;
            max = this.FROZEN_INTERVAL;
        } else {
            frames = this.frozenFrames;
            interval = this.FROZEN_INTERVAL;
            max = Number.POSITIVE_INFINITY;
        }
        appProcesses.forEach((process) => {
            process.frames.forEach((frame) => {
                if (frame.totalDuration >= interval && frame.totalDuration < max) {
                    let frozen = frames[process.stableId] || [];
                    frame["pid"] = process.stableId;
                    frame["proc_name"] = process.userFriendlyName;
                    this.evaluateRootCauses(frame);
                    this.frames.push(frame);
                    frozen.push(frame);
                    frames[process.stableId] = frozen;
                }
            })
        });
    }

    collectAlerts() {
        // collect alerts for slow rendering
        this.collectAlertsFor("slow");
        // collect alerts for frozen frames
        this.collectAlertsFor("frozen");

        // console.log(this.alerts);
    }

    collectAlertsFor(condition) {
        let alert_count = this.alerts[condition] || {};
        let frameArray;
        if (condition === "slow")
            frameArray = this.slowRendering;
        else
            frameArray = this.frozenFrames;
        let keys = Object.keys(frameArray);
        if (keys !== undefined) {
            keys.forEach((key) => {
                frameArray[key].forEach((frame) => {
                    frame.associatedAlerts.events_.forEach((alert) => {
                        alert_count[alert.title] = alert_count[alert.title] || [];
                        frame["cur_action"] = this.findActionByTime(alert.start);
                        alert_count[alert.title].push(frame);
                    })
                })
            });
            this.alerts[condition] = alert_count;
        }
    }

    findActionByTime(time) {
        let time_offset;
        if (this.model.realtime_to_monotonic_offset_ms !== undefined)
            time_offset = this.model.realtime_to_monotonic_offset_ms + this.model.realtime_ts;
        else
            time_offset = -this.model.timestampShiftToZeroAmount_;
        let timestamps = Object.keys(this.timeLine);
        for (let i = timestamps.length - 1; i >= 0; i--) {
            if (parseFloat(timestamps[i]) / 1000 < time + time_offset)
                return this.timeLine[timestamps[i]];
        }

        return "Starting"
    }

    evaluateRootCauses(frame) {
        let alerts = frame.associatedAlerts.events_;
        frame.root_cause = [];
        alerts.forEach((alert) => {
            frame.root_cause = frame.root_cause.concat(this.inquireAlert(alert, frame));
        })
    }

    inquireAlert(alert, frame) {
        if (alert.title === "Expensive measure/layout pass" ||
            alert.title === "Long View#draw()") {
            return this.diagnoseLongDrawing(alert, frame);
        }
        if (alert.title === "Scheduling delay") {
            let cause_titles = Object.keys(alert.args);
            let causes = [];
            cause_titles.forEach((title)=>{
                let elapse = alert.args[title].value;
                causes.push(new RootCause(title, elapse/frame.totalDuration, elapse))
            });
            return causes;
        } else return [new RootCause(alert.title)]
    }

    diagnoseLongDrawing(alert, frame) {
        let causes = [];
        let cpuScore;
        if (alert.title === "Expensive measure/layout pass" ||
            alert.title === "Long View#draw()") {
            let measure = [], layout = [], draw = [];
            alert.associatedEvents.events_.forEach((relatedEvent) => {
                if (relatedEvent.analysisTypeName === "measure")
                    measure.push(relatedEvent);
                else if (relatedEvent.analysisTypeName === "layout")
                    layout.push(relatedEvent);
                else if (relatedEvent.analysisTypeName === "Record View#draw()")
                    draw.push(relatedEvent);
            });

            // collect all thread slices containing the state of the thread
            let steps = measure.concat(layout).concat(draw);
            let slices = [];
            let stepDuration = 0;
            steps.forEach((step) => {
                if (step !== null) {
                    stepDuration += step.duration;
                    slices = slices.concat(this.collectSlicesByRange(step.range, step.parentContainer.timeSlices))
                }
            });

            // running duration
            causes.push(new RootCause(alert.title, stepDuration / frame.totalDuration, stepDuration));

            // check CPU frequency
            let cpuFreq = 0;
            let totalRunning = 0;
            let maxFreq = 0;
            slices.forEach((slice) => {
                if (slice.schedulingState === "Running") {
                    let cpu = slice.cpuOnWhichThreadWasRunning;
                    let freq = this.collectCPUFreqByRange(slice.range, cpu);
                    cpuFreq += freq * slice.duration;
                    totalRunning += slice.duration;
                    if (this.cpus[cpu.cpuNumber] > maxFreq)
                        maxFreq = this.cpus[cpu.cpuNumber];
                }
            });
            if (maxFreq === undefined)
                maxFreq = 0;
            cpuFreq = cpuFreq / totalRunning;
            if (cpuFreq < maxFreq) {
                cpuScore = 1 - cpuFreq / maxFreq;
                causes.push(new RootCause("Low CPU frequency", cpuScore, `${cpuFreq}/${maxFreq}`));
            }

            // check scheduling
            let scheduling = false;
            frame.associatedAlerts.events_.forEach((alert) => {
                if (alert.userFriendlyName.startsWith("Alert Scheduling delay"))
                    scheduling = true;
            });
            if (scheduling) {
                let schedulingCauses = this.diagnoseSchedulingDelay(slices);
                schedulingCauses.forEach((cause)=>{
                    cause.name = alert.title + " " + cause.name
                });
                causes = causes.concat(schedulingCauses)
            }
        }

        return causes;
    }

    diagnoseSchedulingDelay(slices) {
        let runnable = 0, sleep = 0, unSleep = 0, running = 0;
        let uninterruptible_cause = {};
        let causes = [];
        slices.forEach((slice) => {
            if (slice.schedulingState === "Running")
                running += slice.duration;
            if (slice.schedulingState === "Runnable")
                runnable += slice.duration;
            if (slice.schedulingState.startsWith("Uninterruptible Sleep")) {
                unSleep += slice.duration;
                let keys = Object.keys(slice.args);
                keys.forEach((key) => {
                    let argContent = slice.args[key];
                    let argEnd = argContent.indexOf("+");
                    argEnd = argEnd === -1 ? argContent.length : argEnd;
                    argContent = argContent.slice(0, argEnd);
                    argContent = `${key} ${argContent}`;
                    let count = uninterruptible_cause[argContent] || 0;
                    uninterruptible_cause[argContent] = count + slice.duration;
                })
            }
            // if (slice.schedulingState === "Sleeping")
            //     sleep += slice.duration;
        });

        if (Object.keys(uninterruptible_cause).length > 0) {
            let keys = Object.keys(uninterruptible_cause);
            keys.forEach((key) => {
                causes.push(new RootCause(key, uninterruptible_cause[key] / running, uninterruptible_cause[key]))
            })
        }
        if (runnable > 0) {
            causes.push(new RootCause(`Runnable`, runnable / running, runnable));
        }
        if (sleep > 0) {
            causes.push(new RootCause(`Sleeping`, sleep / running, sleep));
        }

        return causes;
    }

    collectCPUFreqByRange(range, cpu) {
        if (cpu.counters[".Clock Frequency"] === undefined)
            return 0;
        cpu.counters[".Clock Frequency"].totals.forEach((freq, idx, totals) => {
            if (cpu.counters[".Clock Frequency"].series_[0].timestamps_[idx] > range.max) {
                if (idx === 0) return this.cpus[cpu.cpuNumber];
                else return totals[idx - 1];
            }
        });

        return this.cpus[cpu.cpuNumber];
    }

    collectSlicesByRange(range, slices) {
        let collectedSlices = [];
        slices.forEach((slice) => {
            if (slice.start >= range.min_ && slice.end <= range.max_)
                collectedSlices.push(slice);
            else if ((slice.start <= range.min_ && slice.end <= range.max_ && slice.end >= range.min_) ||
                (slice.start >= range.min_ && slice.end >= range.max_ && slice.start <= range.max_)) {
                slice.boundsRange.min_ = Math.max(range.min_, slice.start);
                slice.boundsRange.max_ = Math.min(range.max_, slice.end);
                slice.duration = slice.boundsRange.max_ - slice.boundsRange.min_;
                collectedSlices.push(slice);
            }
        });
        return collectedSlices;
    }

    collectCPUSpecs() {
        let cpuKeys = Object.keys(this.model.kernel.cpus);
        cpuKeys.forEach((cpuKey) => {
            let cpu = this.model.kernel.cpus[cpuKey];
            if (cpu.counters[".Clock Frequency"]) {
                let maxFreq = Math.max.apply(null, cpu.counters[".Clock Frequency"].totals);
                this.cpus.push(maxFreq);
            }
        })
    }

    logResults() {
        let frameResults = [];
        this.frames.sort((a, b) => {
            return a.start - b.start
        });
        this.frames.forEach((frame) => {
            let frameResult = {};
            frameResult.start = frame.start;
            frameResult.duration = frame.totalDuration;
            frameResult.cur_action = frame.cur_action;
            frameResult.proc_name = frame.proc_name;
            frame.root_cause.sort((a, b) => {
                return b.score - a.score
            });
            frameResult.root_cause = frame.root_cause;
            frameResults.push(frameResult);
        });

        this.frames = frameResults;
        // let filePath = this.tracePath.split('/');
        // filePath = filePath[filePath.length - 1];
        // filePath = filePath.replace("html", "json");
        // if (!fs.existsSync("frames"))
        //     fs.mkdir("frames");
        // fs.writeFileSync(`./frames/${filePath}`, JSON.stringify(frameResults));
    }
}

class RootCause {
    constructor(name, score, value) {
        this.name = name;
        this.score = score;
        this.value = value;
    }
}

let arguments = process.argv.splice(2);
let dirPath = arguments[0];
let files = fs.readdirSync(dirPath);
let analyzer;
let frameCount = 0;
let frameData = [];
for (let idx in files) {
    if (!files.hasOwnProperty(idx)) continue;
    if (files[idx].indexOf(".html") > -1) {
        this.model = undefined;
        console.log(`Analyzing ${files[idx]}...`);
        try {
            analyzer = new Analyzer(dirPath, `${dirPath}/${files[idx]}`);
            frameCount += analyzer.frameCount;
            frameData = frameData.concat(analyzer.frames);
            analyzer = undefined;
        } catch (e) {
            console.log(e);
            console.log(`Failed to analyze ${files[idx]}`);
        }
    }
}
frameData = {"frameCount": frameCount, "frameData": frameData};
fs.writeFileSync(arguments[1], JSON.stringify(frameData));
console.log(frameCount);