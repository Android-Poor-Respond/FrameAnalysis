package com.example.android.testing.uiautomator.FrameBench;

import org.json.JSONException;
import org.json.JSONObject;
import org.junit.After;
import org.junit.AfterClass;
import org.junit.Assert;
import org.junit.BeforeClass;
import org.junit.Test;
import org.junit.runner.RunWith;

import android.Manifest;
import android.app.UiAutomation;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.os.Build;
import android.os.Environment;
import android.os.RemoteException;
import android.os.SystemClock;
import android.util.ArrayMap;

import static androidx.test.core.app.ApplicationProvider.getApplicationContext;
import static androidx.test.platform.app.InstrumentationRegistry.getInstrumentation;

import androidx.core.app.ActivityCompat;
import androidx.test.filters.SdkSuppress;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import androidx.test.rule.GrantPermissionRule;
import androidx.test.uiautomator.By;
import androidx.test.uiautomator.BySelector;
import androidx.test.uiautomator.UiDevice;
import androidx.test.uiautomator.Until;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.math.BigDecimal;
import java.util.Arrays;

import static org.hamcrest.CoreMatchers.notNullValue;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertThat;
import static org.junit.Assert.assertTrue;

/**
 * Automated UI testing.
 */
@RunWith(AndroidJUnit4.class)
@SdkSuppress(minSdkVersion = 18)
public class AutoUITest {

    private static final String[] PACKAGE_NAMES = {
            "com.facebook.orca", "com.whatsapp", "com.spotify.music", "com.instagram.android",
            "com.facebook.katana", "com.supercell.clashofclans", "com.kiloo.subwaysurf",
            "com.google.android.gm", "com.android.chrome", "com.google.android.youtube"
    };

    private static final String[] NAMES = {
            "Messenger", "WhatsApp", "Spotify", "Instagram", "Facebook",
            "Clash of Clans", "Subway Surf", "Gmail", "Chrome", "YouTube"
    };

    private static ArrayMap<String, String> namePkgMap = new ArrayMap<>();

    private static final int LAUNCH_TIMEOUT = 5000;
    private static final int CLICK_TIMEOUT = 15000;
    private static final int LONG_TIMEOUT = 25000;

    private static UiDevice mDevice;

    private static ArrayMap<Double, String> timeLine = new ArrayMap<>();

    private static boolean isClean = false;

    private String appName = null;

    private static int height;
    private static int width;

    @BeforeClass
    public static void prepare() throws RemoteException, IOException {
        // Initialize UiDevice instance
        mDevice = UiDevice.getInstance(getInstrumentation());
        String launcherPkg = getLauncherPackageName();
        assertThat(launcherPkg, notNullValue());
        height = mDevice.getDisplayHeight();
        width = mDevice.getDisplayWidth();

        for (int i = 0; i < NAMES.length; i++) {
            namePkgMap.put(NAMES[i], PACKAGE_NAMES[i]);
        }

        if (!mDevice.isScreenOn()) {
            mDevice.wakeUp();
        }
        mDevice.pressHome();
        mDevice.wait(Until.hasObject(By.pkg(launcherPkg).depth(0)), LAUNCH_TIMEOUT);

        requestPermissions(Manifest.permission.WRITE_EXTERNAL_STORAGE, Manifest.permission.READ_EXTERNAL_STORAGE);

        cleanXMLFiles();

        cleanUp();
    }

    @Test
    public void checkPreconditions() {
        assertThat(mDevice, notNullValue());
    }

    @Test
    public void testMessenger() {
        appName = "Messenger";
        BySelector selector;
        launchApp();

        if (isClean) {
            log("Language setting");
            BySelector settingSelector = By.textContains("正在设");
            mDevice.wait(Until.hasObject(settingSelector), LAUNCH_TIMEOUT);
            mDevice.wait(Until.gone(settingSelector), LONG_TIMEOUT);

            log("Login");
            dumpHierarchy();
            BySelector smartLockSelector = By.res("com.google.android.gms", "credential_primary_label");
            clickDefinitiveComponent(smartLockSelector);
            BySelector loginSelector = By.descContains("登录");
            mDevice.wait(Until.hasObject(loginSelector), LAUNCH_TIMEOUT);
            if (!mDevice.hasObject(loginSelector)) {
                BySelector continueSelector = By.descContains("继续");
                clickDefinitiveComponent(continueSelector);
            } else
                clickDefinitiveComponent(loginSelector);

            selector = By.descContains("暂不");
            clickDefinitiveComponent(selector);
            dumpHierarchy();

            selector = By.text("确定");
            clickDefinitiveComponent(selector);
            dumpHierarchy();

            selector = By.descContains("以后再说");
            clickDefinitiveComponent(selector);
            dumpHierarchy();
        }

        // swipe to refresh
        log("Refreshing");
        mDevice.waitForIdle();
        dumpHierarchy();
        mDevice.swipe(width/2, height/3, width/2, height/3*2, 5);
        mDevice.waitForIdle();

        // click user
        log("Click into User");
        selector = By.descContains("用户");
        clickDefinitiveComponent(selector);
        dumpHierarchy();

        // swipe to refresh
        log("Refreshing");
        mDevice.waitForIdle();
        dumpHierarchy();
        mDevice.swipe(width/2, height/3, width/2, height/3*2, 5);
        mDevice.waitForIdle();
    }

    @Test
    public void testWhatsApp() {
        appName = "WhatsApp";
        launchApp();

        // swipe to refresh
        log("Swiping");
        for (int i = 0; i < 3; i++) {
            mDevice.swipe(width/3*2, height/2, width/3, height/2, 5);
            mDevice.waitForIdle();
        }
    }

    @Test
    public void testSpotify() throws InterruptedException {
        appName = "Spotify";
        launchApp();

        mDevice.wait(Until.hasObject(By.res(mDevice.getCurrentPackageName(),
                "bottom_navigation_item_icon")), LONG_TIMEOUT);

        // scroll to view
        log("Swiping");
        mDevice.waitForIdle();
        BySelector ad = By.res(mDevice.getCurrentPackageName(), "footer_test");
        mDevice.wait(Until.hasObject(ad), LAUNCH_TIMEOUT);
        clickDefinitiveComponent(ad);
        dumpHierarchy();
        for (int i = 0; i < 10; i++) {
            mDevice.swipe(width/2, height/3*2, width/2, height/3, 5);
            mDevice.waitForIdle();
        }

        log("Playing music");
        // play music
        mDevice.findObject(By.res(mDevice.getCurrentPackageName(), "image")).click();
        BySelector selector = By.textContains("PLAY");
        clickDefinitiveComponent(selector);
        selector = By.res(mDevice.getCurrentPackageName(), "btn_play");
        mDevice.wait(Until.hasObject(selector), LAUNCH_TIMEOUT);
        if (mDevice.hasObject(selector))
            mDevice.pressBack();
        selector = By.res(mDevice.getCurrentPackageName(), "cta_button");
        clickDefinitiveComponent(selector);
//        selector = By.res(mDevice.getCurrentPackageName(), "labels");
//        clickDefinitiveComponent(selector);
        dumpHierarchy();

        log("Swiping");
        // scroll to view
        for (int i = 0; i < 5; i++) {
            mDevice.swipe(width/2, height/3*2, width/2, height/3, 5);
            mDevice.waitForIdle();
        }
        mDevice.pressBack();
        selector = By.res(mDevice.getCurrentPackageName(), "play_pause_button");
        clickDefinitiveComponent(selector);
    }

    @Test
    public void testInstagram() {
        appName = "Instagram";
        BySelector selector;
        launchApp();

        if (isClean) {
            log("Login");
            selector = By.res("com.google.android.gms", "credential_primary_label");
            clickDefinitiveComponent(selector);
        }

        // wait till the main page shows up
        selector = By.res(mDevice.getCurrentPackageName(), "action_bar_inbox_button");
        mDevice.wait(Until.hasObject(selector), LONG_TIMEOUT);
        dumpHierarchy();

        // swipe to refresh
        log("Refreshing");
        mDevice.swipe(width/2, height/3, width/2, height/3*2, 5);
        mDevice.waitForIdle();
        dumpHierarchy();

        // scroll to view
        log("Swiping");
        for (int i = 0; i < 10; i++) {
            mDevice.swipe(width/2, height/3*2, width/2, height/3, 5);
            mDevice.waitForIdle();
        }

        // open a feed
        log("View feed");
        selector = By.res(mDevice.getCurrentPackageName(), "row_feed_comment_textview_layout");
        mDevice.wait(Until.hasObject(selector), LAUNCH_TIMEOUT);
        if (mDevice.hasObject(selector)) {
            clickDefinitiveComponent(selector);
            dumpHierarchy();
            for (int i = 0; i < 10; i++) {
                mDevice.swipe(width/2, height/3*2, width/2, height/3, 5);
                mDevice.waitForIdle();
            }
            mDevice.pressBack();
        }

        // view discovery
        log("View discovery");
        selector = By.descContains("搜索发现");
        clickDefinitiveComponent(selector);
        dumpHierarchy();
        for (int i = 0; i < 10; i++) {
            mDevice.swipe(width/2, height/3*2, width/2, height/3, 5);
            mDevice.waitForIdle();
        }
    }

    @Test
    public void testFacebook() {
        appName = "Facebook";
        BySelector selector;
        launchApp();

        if (isClean) {
            log("Login");
            selector = By.text("确定");
            mDevice.wait(Until.hasObject(selector), LONG_TIMEOUT);
            clickDefinitiveComponent(selector);

            // grant permissions
            selector = By.descContains("允许");
            mDevice.wait(Until.findObject(selector), LONG_TIMEOUT);
            mDevice.pressBack();
            mDevice.pressHome();
            launchApp();
            dumpHierarchy();
        }

        // wait for the main page
        selector = By.descContains("个人主页");
        mDevice.wait(Until.hasObject(selector), LONG_TIMEOUT);
        dumpHierarchy();

        // swipe to refresh
        log("Refreshing");
        mDevice.swipe(width/2, height/3, width/2, height/3*2, 5);
        mDevice.waitForIdle();

        // scroll to view
        log("Swiping");
        for (int i = 0; i < 10; i++) {
            mDevice.swipe(width/2, height/3*2, width/2, height/3, 5);
            mDevice.waitForIdle();
        }

        // view feedback
        selector = By.descContains("评论");
        clickDefinitiveComponent(selector);
        mDevice.pressBack();
        for (int i = 0; i < 10; i++) {
            mDevice.swipe(width/2, height/3*2, width/2, height/3, 5);
            mDevice.waitForIdle();
        }
        mDevice.pressBack();
    }

    @Test
    public void testClashOfClans() throws InterruptedException {
        appName = "Clash of Clans";
        launchApp();

        log("Entering game");
        BySelector selector = By.res("android", "button3");
        mDevice.wait(Until.hasObject(selector), LONG_TIMEOUT);
        clickDefinitiveComponent(selector);

        log("Play game");
        for (int i = 0; i < 3; i++) {
            mDevice.click(1000, 1000);
            mDevice.waitForIdle();
        }
        // random swipe
        for (int i = 0; i < 5; i++) {
            int height = mDevice.getDisplayHeight();
            int width = mDevice.getDisplayWidth();
            int startX = (int) (Math.random() % width);
            int startY = (int) (Math.random() % height);
            int endX = (int) (Math.random() % width);
            int endY = (int) (Math.random() % height);
            mDevice.swipe(startX, startY, endX, endY, 10);
            Thread.sleep(2000);
        }
    }

    @Test
    public void testSubwaySurf() throws InterruptedException {
        appName = "Subway Surf";
        launchApp();
        mDevice.wait(Until.hasObject(By.text("NO")), LONG_TIMEOUT);

        log("Entering game");
        mDevice.click(1000, 1000);
        mDevice.waitForIdle();
        mDevice.wait(Until.hasObject(By.text("NO")), LONG_TIMEOUT);
    }

    @Test
    public void testGmail() throws InterruptedException {
        appName = "Gmail";
        BySelector selector;
        launchApp();

        if (isClean) {
            log("Login");
            selector = By.res(mDevice.getCurrentPackageName(), "welcome_tour_got_it");
            dumpHierarchy();
            clickDefinitiveComponent(selector);

            selector = By.res(mDevice.getCurrentPackageName(), "account_address");
            mDevice.wait(Until.hasObject(selector), LONG_TIMEOUT);
            selector = By.res(mDevice.getCurrentPackageName(), "action_done");
            dumpHierarchy();
            clickDefinitiveComponent(selector);
        }

        selector = By.res(mDevice.getCurrentPackageName(), "og_apd_ring_view");
        mDevice.wait(Until.hasObject(selector), LAUNCH_TIMEOUT);

        // swipe to refresh
        log("Refreshing");
        // swipe to refresh
        mDevice.swipe(width/2, height/3, width/2, height/3*2, 5);
        mDevice.waitForIdle();
        dumpHierarchy();

        // scroll to view
        log("Swiping");
        // scroll to view
        for (int i = 0; i < 10; i++) {
            mDevice.swipe(width/2, height/3*2, width/2, height/3, 5);
            mDevice.waitForIdle();
        }

        // view an email
        log("Entering a mail");
        selector = By.res(mDevice.getCurrentPackageName(), "senders");
        clickDefinitiveComponent(selector);
        if (isClean) {
            selector = By.textContains("延后");
            mDevice.wait(Until.findObject(selector), LAUNCH_TIMEOUT);
            mDevice.click(500, 1500);
        }
        Thread.sleep(3000);
        dumpHierarchy();
        mDevice.pressBack();
    }

    @Test
    public void testChrome() throws InterruptedException {
        appName = "Chrome";
        BySelector selector;
        launchApp();

        final String[] websites = {
                "google.com", "youtube.com", "twitter.com", "qq.com", "baidu.com",
                "facebook.com", "sohu.com", "360.cn", "yahoo.com", "taobao.com"
        };

        if (isClean) {
            log("Initiating");
            selector = By.res(mDevice.getCurrentPackageName(), "terms_accept");
            dumpHierarchy();
            clickDefinitiveComponent(selector);

            selector = By.res(mDevice.getCurrentPackageName(), "positive_button");
            dumpHierarchy();
            clickDefinitiveComponent(selector);
        }

        // load web pages
        for (String website : websites) {
            log("Loading " + website);
            BySelector url_selector = By.res(mDevice.getCurrentPackageName(), "url_bar");
            if (!mDevice.hasObject(url_selector)) {
                selector = By.res(mDevice.getCurrentPackageName(), "search_box_text");
                clickDefinitiveComponent(selector);
            }

            clickDefinitiveComponent(url_selector);
            dumpHierarchy();
            mDevice.findObject(url_selector).setText(website);
            selector = By.text(website).clazz("android.widget.TextView");
            clickDefinitiveComponent(selector);
            selector = By.clazz("android.widget.ProgressBar");
            mDevice.wait(Until.hasObject(selector), LAUNCH_TIMEOUT);
            mDevice.wait(Until.gone(selector), LAUNCH_TIMEOUT * 3);
            dumpHierarchy();

            // scroll to view
            log("Swiping");
            for (int i = 0; i < 5; i++) {
                mDevice.swipe(width/2, height/3*2, width/2, height/3, 5);
                Thread.sleep(1500);
                mDevice.waitForIdle();
            }

            mDevice.swipe(width/2, height/3, width/2, height/3*2, 5);
            mDevice.waitForIdle();
        }
    }

    @Test
    public void testYouTube() throws InterruptedException {
        appName = "YouTube";
        launchApp();

        BySelector selector = By.res(mDevice.getCurrentPackageName(), "menu_item_1");
        mDevice.wait(Until.hasObject(selector), LONG_TIMEOUT);
        dumpHierarchy();

        log("Refreshing");
        // swipe to refresh
        mDevice.swipe(width/2, height/3, width/2, height/3*2, 5);
        mDevice.waitForIdle();

        log("Swiping");
        // scroll to view
        for (int i = 0; i < 10; i++) {
            mDevice.swipe(width/2, height/3*2, width/2, height/3, 5);
            mDevice.waitForIdle();
        }

        log("Entering a video");
        mDevice.click(width/2, height/2);
        mDevice.waitForIdle();
        Thread.sleep(3000);
        dumpHierarchy();
    }

    private void dumpHierarchy() {
        File appDir = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS), appName);
        if (!appDir.exists()) {
            boolean mkdir = appDir.mkdirs();
            Assert.assertTrue(mkdir);
        } else {
            BigDecimal time = new BigDecimal(SystemClock.elapsedRealtimeNanos() / 1000.0);
            File dumpFile = new File(appDir, time.toString() + ".xml");
            boolean createFile;
            try {
                createFile = dumpFile.createNewFile();
                Assert.assertTrue(createFile);
                mDevice.dumpWindowHierarchy(dumpFile);
            } catch (IOException e) {
                e.printStackTrace();
            }
        }
    }

    private void clickDefinitiveComponent(BySelector selector) {
        mDevice.waitForIdle();
        mDevice.wait(Until.hasObject(selector), CLICK_TIMEOUT);
        if (!mDevice.hasObject(selector))
            return;
        mDevice.findObject(selector).click();
        mDevice.waitForIdle();
    }

    private void launchApp() {
        String packageName = namePkgMap.get(appName);
        log("Launching");
        Context context = getApplicationContext();
        assert packageName != null;
        try {
            context.getPackageManager().getPackageGids(packageName);
        } catch (PackageManager.NameNotFoundException e) {
            if (appName.equals("Messenger"))
                packageName = "com.facebook.mlite";
        }
        final Intent intent = context.getPackageManager()
                .getLaunchIntentForPackage(packageName);
        assert intent != null;
        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TASK);    // Clear out any previous instances
        context.startActivity(intent);

        // Wait for the app to appear
        mDevice.wait(Until.hasObject(By.pkg(packageName).depth(0)), LAUNCH_TIMEOUT);
        mDevice.waitForIdle();
    }

    private static String getLauncherPackageName() {
        // Create launcher Intent
        final Intent intent = new Intent(Intent.ACTION_MAIN);
        intent.addCategory(Intent.CATEGORY_HOME);

        // Use PackageManager to get the launcher package name
        PackageManager pm = getApplicationContext().getPackageManager();
        ResolveInfo resolveInfo = pm.resolveActivity(intent, PackageManager.MATCH_DEFAULT_ONLY);
        return resolveInfo.activityInfo.packageName;
    }

    private static void requestPermissions(String... permissions) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            UiAutomation auto = InstrumentationRegistry.getInstrumentation().getUiAutomation();
            String cmd = "pm grant " + InstrumentationRegistry.getInstrumentation().getTargetContext().getPackageName() + " %1$s";
            String cmdTest = "pm grant " + InstrumentationRegistry.getInstrumentation().getContext().getPackageName() + " %1$s";
            for (String perm : permissions) {
                auto.executeShellCommand(String.format(cmd, perm));
                auto.executeShellCommand(String.format(cmdTest, perm));
            }
        }
        GrantPermissionRule.grant(permissions);

        int grantResult = ActivityCompat.checkSelfPermission(InstrumentationRegistry.getInstrumentation().getTargetContext(), Manifest.permission.WRITE_EXTERNAL_STORAGE);
        Assert.assertEquals(PackageManager.PERMISSION_GRANTED, grantResult);
        grantResult = ActivityCompat.checkSelfPermission(InstrumentationRegistry.getInstrumentation().getContext(), Manifest.permission.WRITE_EXTERNAL_STORAGE);
        Assert.assertEquals(PackageManager.PERMISSION_GRANTED, grantResult);
    }

    private static void cleanXMLFiles() {
        for (String appName : NAMES) {
            File appDir = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS), appName);
            if (appDir.exists()) {
                File[] files = appDir.listFiles();
                for (File file : files) {
                    boolean del = file.delete();
                    assertTrue(del);
                }
            }
        }
    }

    private static void cleanUp() throws IOException {
        if (isClean) {
            String[] packages = {"com.facebook.orca", "com.spotify.music", "com.instagram.android",
                    "com.facebook.katana", "com.supercell.clashofclans", "com.android.chrome", "com.google.android.youtube"};

            for (String pkg : packages) {
                mDevice.executeShellCommand("pm clear " + pkg);
            }
        } else {
            for (String packages : PACKAGE_NAMES) {
                mDevice.executeShellCommand("am force-stop " + packages);
            }
        }
    }

    private void log(String content) {
        double time = SystemClock.elapsedRealtimeNanos() / 1000.0;
        timeLine.put(time, content + "---" + appName);
    }

    @After
    public void clean() throws IOException, InterruptedException {
        Thread.sleep(2000);
        mDevice.pressHome();
        for (String packages : PACKAGE_NAMES) {
            mDevice.executeShellCommand("am force-stop " + packages);
        }
    }

    @AfterClass
    public static void saveTimeLineLogs() throws IOException, JSONException {
        File timeLineFile = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS), "timeLine.json");
        if (!timeLineFile.exists()) {
            boolean exist = timeLineFile.createNewFile();
            assertTrue(exist);
        }
        FileOutputStream stream = new FileOutputStream(timeLineFile);
        JSONObject json = new JSONObject();
        Double[] keys = new Double[timeLine.size()];
        timeLine.keySet().toArray(keys);
        Arrays.sort(keys);
        for (Double key : keys) {
            BigDecimal time = new BigDecimal(key);
            json.put(time.toString(), timeLine.get(key));
        }
        stream.write(json.toString().getBytes());
        stream.flush();
        stream.close();
    }
}
