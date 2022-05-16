import json
import numpy as np
import os

if __name__ == '__main__':
    device = "Pixel3"
    file_names = os.listdir("data")
    device_files = []
    frames = []
    frequencies = []
    frame_count = 0

    for file_name in file_names:
        if file_name.startswith("trace-" + device):
            device_files.append(file_name)
    for device_file in device_files:
        data = json.load(open("./data/" + device_file, 'r'))
        frames.extend(data["frameData"])
        frame_count += data["frameCount"]
        frequencies.append(len(data["frameData"]) / data["frameCount"])

    durations = []
    for frame in frames:
        durations.append(frame["duration"])
    print(durations)
    print(frequencies)
    durations = np.array(durations)
    print(frame_count)
    print(min(durations), np.median(durations), durations.mean(), max(durations), sum(durations), len(durations),
          len(durations) / frame_count, np.std(frequencies))

    root_causes = {}
    root_causes_time = {}
    count = 0
    schedule_count = 0
    sche_count = 0
    ex_count = 0
    exp_count = 0
    for frame in frames:
        # expensive = False
        # schedule = False

        if len(frame["root_cause"]) == 0:
            root_cause = {"name": "Running", "value": frame["duration"], "score": 1}
        else:
            root_cause = frame["root_cause"][0]

        # if root_cause["name"] == "Expensive measure/layout pass" or root_cause['name'] == "Long View#draw()":
        #     expensive = True
        #     exp_count += root_cause["value"]
        # if "kernel callsite" in root_cause["name"] or "Runnable" in root_cause["name"]:
        #     schedule = True
        #     schedule_count += root_cause["value"]

        root_causes[root_cause["name"]] = (root_causes.get(root_cause["name"]) or 0) + 1

        value = 0
        try:
            value = float(root_cause["value"])
        except:
            pass
        root_causes_time[root_cause["name"]] = (root_causes.get(root_cause["name"]) or 0) + value

        # if expensive and schedule:
        #     count += 1
        # if expensive:
        #     ex_count += 1
        # if schedule:
        #     sche_count += 1
    root_causes = sorted(root_causes.items(), key=lambda x: x[1], reverse=True)
    root_causes_time = sorted(root_causes_time.items(), key=lambda x: x[1], reverse=True)
    print(root_causes)
    print(root_causes_time)
    # print(count)
    # print(exp_count, schedule_count)
    # print(ex_count, sche_count)
