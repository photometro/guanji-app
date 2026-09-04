package com.guanji.app;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** #201：WebView 首屏完成后通知原生退出 SplashScreen。 */
@CapacitorPlugin(name = "StartupReady")
public class StartupReadyPlugin extends Plugin {

    @PluginMethod
    public void ready(PluginCall call) {
        if (getActivity() instanceof MainActivity) {
            ((MainActivity) getActivity()).markStartupReady();
        }
        call.resolve();
    }
}
