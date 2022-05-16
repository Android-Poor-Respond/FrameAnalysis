from subprocess import *
import os

PACKAGE_NAMES = ["com.facebook.orca", "com.whatsapp", "com.spotify.music", "com.instagram.android",
                 "com.facebook.katana", "com.supercell.clashofclans", "com.kiloo.subwaysurf",
                 "com.google.android.gm", "com.android.chrome", "com.google.android.youtube"]

NAMES = ["Messenger", "WhatsApp", "Spotify", "Instagram", "Facebook",
         "Clash Of Clans", "Subway Surf", "Gmail", "Chrome", "YouTube"]


def check_app_status(app_name):
    cmd = "adb shell am instrument -w -r    -e debug false -e class " \
          "'com.example.android.testing.uiautomator.BasicSample.PrepareTest#test{}' " \
          "com.example.android.testing.uiautomator.BasicSample.test/androidx.test.runner.AndroidJUnitRunner" \
        .format(app_name.replace(" ", ""))

    out, err = exec_shell(cmd)
    if err or "FAILURES!!!" in out:
        print "You have not finished initializing {}...".format(app_name)
        print "We will open it again. What you need to do is finishing the app's initialization including login."
        return False
    return True


def initialize_app(name, package):
    print "Waiting for the completion of {}'s initialization...".format(name)
    result = False
    while not result:
        cmd = "adb shell monkey -p {} -c android.intent.category.LAUNCHER 1".format(package)
        out, err = exec_shell(cmd, stderr=STDOUT)
        if err:
            print "Cannot open {}...".format(name)
            raise Exception(err)
        raw_input("Please press ENTER when you finished initialization...")
        print "Checking initialization..."
        result = check_app_status(name)


def check():
    # install the instrumentation app
    cmd = "adb shell pm list packages"
    out, _ = exec_shell(cmd)
    if "uiautomator" not in out:
        print "--------------------------------"
        print "Installing the instrumentation app..."
        cmd = "adb install ./APKs/app.apk"
        out, err = exec_shell(cmd)
        if err and "INSTALL_FAILED_ALREADY_EXISTS" not in err:
            raise Exception(err)

    # check missing apps
    cmd = "adb shell pm list packages"
    out, err = exec_shell(cmd)
    apps = []
    if err:
        raise Exception(err)
    for name, package in zip(NAMES, PACKAGE_NAMES):
        if package not in out:
            apps.append(name)
    if len(apps) > 0:
        print "--------------------------------"
        print "Missing {}".format(", ".join(apps))
    for app in apps:
        print "Installing {}...".format(app)
        cmd = "adb install ./APKs/{}.apk".format(app)
        _, err = exec_shell(cmd)
        if err:
            raise Exception(err)

    # check all instrumented apps' status
    print "--------------------------------"
    print "Checking all apps' initialization status..."
    for name, package in zip(NAMES, PACKAGE_NAMES):
        print "\nChecking {}...".format(name)
        result = check_app_status(name)
        if not result:
            initialize_app(name, package)
        print "Initialization of {} has completed!\n".format(name)


def exec_shell(cmd, shell=True, stdout=PIPE, stderr=PIPE, close_fds=True):
    proc = Popen(cmd, shell=shell, stdout=stdout, stderr=stderr, close_fds=close_fds)
    return proc.communicate()


if __name__ == "__main__":
    # os.environ['PATH'] = "/home/yoda/Android/Sdk/platform-tools:" + os.environ['PATH']
    check()
