from multiprocessing import Queue, Process
import os
import time
import re
import pickle


class Frame:
    def __init__(self):
        self.queue = Queue()
        self.flag = Queue(1)
        self.gfx_data = dict()

        self.proc_pull = Process(target=self.pull_gfx_info, daemon=True)
        self.proc_analyze = Process(target=self.analyze_gfx_info, daemon=True)

    def run(self):
        self.purge_gfx_info()

        self.proc_pull.start()
        self.proc_analyze.start()

    def stop(self):
        self.flag.put(True)
        self.proc_pull.join()
        self.proc_analyze.join()


    def purge_gfx_info(self):
        gfx_info = os.popen("adb shell dumpsys gfxinfo").read()
        packages = re.findall(r"\*\* Graphics info for pid .* \[(.*)\] \*\*", gfx_info)
        for package in packages:
            os.popen("adb shell dumpsys gfxinfo {} reset".format(package))

    def pull_gfx_info(self):
        while True:
            if self.flag.full():
                break
            gfx_info = os.popen("adb shell dumpsys gfxinfo").read()
            self.queue.put(gfx_info)
            time.sleep(1)

    def analyze_gfx_info(self):
        while True:
            if self.flag.full() and self.queue.empty():
                break
            if self.queue.empty():
                continue

            gfx_info = self.queue.get()
            packages = re.split(r"\*\* Graphics info for pid .* \[.*\] \*\*", gfx_info)[1:]
            package_names = re.findall(r"\*\* Graphics info for pid .* \[(.*)\] \*\*", gfx_info)
            for package, package_name in zip(packages, package_names):
                package_data = self.gfx_data.get(package_name) or dict()
                package_data['total_frames'] = int(re.findall(r"Total frames rendered: (.*)", package)[0])
                package_data['janky_frames'] = int(re.findall(r'Janky frames: (.*) \(.*\)', package)[0])

                views = re.split(r"\s*.*/android.view.ViewRootImpl@.* \(visibility=\d*\)", package)[1:]
                view_names = re.findall(r"\s*(.*)/android.view.ViewRootImpl@.* \(visibility=\d*\)", package)
                visibilities = re.findall(r"\s*.*/android.view.ViewRootImpl@.* \(visibility=(\d*)\)", package)
                view_data = package_data.get('view_data') or dict()
                for view, view_name, visibility in zip(views, view_names, visibilities):
                    if visibility == '8':
                        continue
                    view_datum = view_data.get(view_name) or dict()

                    last_frames_count = view_datum.get('total_frames') or 0
                    current_frames_count = int(re.findall(r"Total frames rendered: (.*)", view)[0])
                    elapsed_frames = current_frames_count - last_frames_count
                    if elapsed_frames == 0:
                        continue

                    view_datum['total_frames'] = current_frames_count
                    view_datum['janky_frames'] = int(re.findall(r'Janky frames: (.*) \(.*\)', view)[0])

                    last_profile_data = view_datum.get('profile_data') or list()
                    current_profile_data = re.findall(r'---PROFILEDATA---(.*)---PROFILEDATA---', view, re.DOTALL)[0]
                    current_profile_data = current_profile_data.split('\n')[1:-1]
                    length = len(current_profile_data)
                    current_profile_data = current_profile_data[length-elapsed_frames: length]
                    current_profile_data = [list(map(int, datum.split(',')[0:-1])) for datum in current_profile_data]
                    last_profile_data.extend(current_profile_data)
                    view_datum['profile_data'] = last_profile_data

                    view_data[view_name] = view_datum

                if len(view_data.keys()) == 0:
                    continue
                package_data['view_data'] = view_data
                self.gfx_data[package_name] = package_data

        self.dump_data()

    def dump_data(self):
        with open('gfx.dat', 'wb+') as file:
            pickle.dump(self.gfx_data, file)

