class Analyzer {
    constructor() {
        let i;
        this.model = null;
        this.slowRendering = {};
        this.frozenFrames = {};
        this.alerts = {};

        this.FRAME_INTERVAL = 16.67;
        this.FROZEN_INTERVAL = 700;

        const traceDataEls = document.body.querySelectorAll('.trace-data');
        const traces = [];
        for (i = 0; i < traceDataEls.length; i++) {
            let traceText = traceDataEls[i].textContent;
            // Remove the leading newline.
            traceText = traceText.substring(1);
            traces.push(traceText);
        }

        const m = new tr.Model();
        i = new tr.importer.Import(m);
        i.importTraces(traces);
        this.model = m;
        this.analyzeAppFrames();
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

        // find processes with slow rendering
        appProcesses.forEach((process) => {
            process.frames.forEach((frame, id) => {
                if (frame.totalDuration > this.FRAME_INTERVAL &&
                    frame.totalDuration < this.FROZEN_INTERVAL) {
                    let slow = this.slowRendering[process.stableId] || [];
                    slow.push(frame);
                    this.slowRendering[process.stableId] = slow;
                }
            })
        });

        // find processes with frozen frames
        appProcesses.forEach((process) => {
            process.frames.forEach((frame) => {
                if (frame.totalDuration >= this.FROZEN_INTERVAL) {
                    let frozen = this.frozenFrames[process.stableId] || [];
                    frozen.push(frame);
                    this.frozenFrames[process.stableId] = frozen;
                }
            })
        });

        this.collectAlerts();
    }

    collectAlerts() {
        // collect alerts for slow rendering
        let slow_alert_count = this.alerts['slow'] || {};
        let keys = Object.keys(this.slowRendering);
        if (keys !== undefined) {
            keys.forEach((key) => {
                this.slowRendering[key].forEach((frame) => {
                    frame.associatedAlerts.events_.forEach((alert) => {
                        slow_alert_count[alert.title] = slow_alert_count[alert.title] || [];
                        slow_alert_count[alert.title].push(frame);
                    })
                })
            });
            this.alerts['slow'] = slow_alert_count;
        }

        // collect alerts for frozen frames
        let frozen_alert_count = this.alerts['frozen'] || {};
        keys = Object.keys(this.frozenFrames);
        if (keys !== undefined) {
            keys.forEach((key) => {
                this.frozenFrames[key].forEach((frame) => {
                    frame.associatedAlerts.events_.forEach((alert) => {
                        frozen_alert_count[alert.title] = frozen_alert_count[alert.title] || [];
                        frozen_alert_count[alert.title].push(frame);
                    })
                })
            });
            this.alerts['frozen'] = frozen_alert_count;
        }

        console.log(this.alerts);
    }
}