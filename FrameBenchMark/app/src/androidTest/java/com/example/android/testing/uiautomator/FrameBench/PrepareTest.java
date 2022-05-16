/*
 * Copyright 2015, The Android Open Source Project
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package com.example.android.testing.uiautomator.FrameBench;

import org.junit.After;
import org.junit.BeforeClass;
import org.junit.Test;
import org.junit.runner.RunWith;

import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.os.RemoteException;
import android.util.ArrayMap;

import static androidx.test.core.app.ApplicationProvider.getApplicationContext;
import static androidx.test.platform.app.InstrumentationRegistry.getInstrumentation;

import androidx.test.filters.SdkSuppress;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.uiautomator.By;
import androidx.test.uiautomator.BySelector;
import androidx.test.uiautomator.UiDevice;
import androidx.test.uiautomator.Until;

import java.io.IOException;

import static org.hamcrest.CoreMatchers.is;
import static org.hamcrest.CoreMatchers.notNullValue;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertThat;
import static org.junit.Assert.assertTrue;

/**
 * Basic sample for unbundled UiAutomator.
 */
@RunWith(AndroidJUnit4.class)
@SdkSuppress(minSdkVersion = 18)
public class PrepareTest {
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
    private static final int LONG_TIMEOUT = 15000;

    private static UiDevice mDevice;

    private String appName = null;

    @BeforeClass
    public static void prepare() throws RemoteException, InterruptedException, IOException {
        // Initialize UiDevice instance
        mDevice = UiDevice.getInstance(getInstrumentation());
        String launcherPkg = getLauncherPackageName();
        assertThat(launcherPkg, notNullValue());

        for (int i = 0; i < NAMES.length; i++) {
            namePkgMap.put(NAMES[i], PACKAGE_NAMES[i]);
        }

        if (!mDevice.isScreenOn()) {
            mDevice.wakeUp();
        }
        mDevice.pressHome();
        mDevice.wait(Until.hasObject(By.pkg(launcherPkg).depth(0)), LAUNCH_TIMEOUT);
    }

    @Test
    public void testMessenger() {
        appName = "Messenger";
        launchApp();

        BySelector selector = By.descContains("聊天");
        checkAppStatus(selector);
    }

    @Test
    public void testWhatsApp() {
        appName = "WhatsApp";
        launchApp();

        BySelector selector = By.res(mDevice.getCurrentPackageName(), "eula_accept");
        assertFalse(mDevice.hasObject(selector));
    }

    @Test
    public void testSpotify() {
        appName = "Spotify";
        launchApp();

        BySelector selector = By.res(mDevice.getCurrentPackageName(),
                "bottom_navigation_item_icon");
        checkAppStatus(selector);
    }

    @Test
    public void testInstagram() {
        appName = "Instagram";
        launchApp();

        BySelector selector = By.res(mDevice.getCurrentPackageName(), "action_bar_inbox_button");
        checkAppStatus(selector);
    }

    @Test
    public void testFacebook() {
        appName = "Facebook";
        launchApp();

        BySelector selector = By.descContains("个人主页");
        checkAppStatus(selector);
    }

    @Test
    public void testClashOfClans() {
        appName = "Clash of Clans";
        launchApp();

        BySelector selector = By.res("android", "button3");
        mDevice.wait(Until.hasObject(selector), LONG_TIMEOUT);
        assertFalse(mDevice.hasObject(selector));
    }

    @Test
    public void testSubwaySurf() {
        appName = "Subway Surf";
        launchApp();
    }

    @Test
    public void testGmail() {
        appName = "Gmail";
        launchApp();

        BySelector selector = By.res(mDevice.getCurrentPackageName(), "og_apd_ring_view");
        checkAppStatus(selector);
    }

    @Test
    public void testChrome() {
        appName = "Chrome";
        launchApp();

        BySelector selector = By.res(mDevice.getCurrentPackageName(), "home_button");
        checkAppStatus(selector);
    }

    @Test
    public void testYouTube() {
        appName = "YouTube";
        launchApp();

        BySelector selector = By.res(mDevice.getCurrentPackageName(), "menu_item_1");
        checkAppStatus(selector);
    }

    private void checkAppStatus(BySelector selector) {
        mDevice.wait(Until.hasObject(selector), LONG_TIMEOUT);
        assertTrue(mDevice.hasObject(selector));
    }

    private void launchApp() {
        String packageName = namePkgMap.get(appName);
        Context context = getApplicationContext();
        assert packageName != null;
        final Intent intent = context.getPackageManager()
                .getLaunchIntentForPackage(packageName);
        assert intent != null;
        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TASK);    // Clear out any previous instances
        context.startActivity(intent);

        // Wait for the app to appear
        mDevice.wait(Until.hasObject(By.pkg(packageName).depth(0)), LAUNCH_TIMEOUT);
        mDevice.waitForIdle();
    }

    @After
    public void clean() throws IOException, InterruptedException {
        Thread.sleep(2000);
        mDevice.pressHome();
        for (String packages : PACKAGE_NAMES) {
            mDevice.executeShellCommand("am force-stop " + packages);
        }
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
}
