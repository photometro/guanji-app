/* #211 N9：原生能力适配层。
   这里仅定义稳定、可降级的能力边界；现有业务调用暂不整体迁移，
   浏览器中返回 unavailable，原生环境再委托 Capacitor 插件实现。 */
(function installNativeCapabilities(global) {
  const getPlugins = () => (global.Capacitor && global.Capacitor.Plugins) || null;
  const isNative = () => !!(global.Capacitor && typeof global.Capacitor.isNativePlatform === 'function' && global.Capacitor.isNativePlatform());
  const plugin = (name) => { const plugins = getPlugins(); return plugins && plugins[name] ? plugins[name] : null; };
  const unavailable = (capability) => Promise.resolve({ ok: false, accepted: false, reason: 'unavailable', capability });
  const call = async (capability, pluginName, method, options) => {
    const target = plugin(pluginName);
    if (!target || typeof target[method] !== 'function') return unavailable(capability);
    try { return await target[method](options || {}); } catch (error) { return { ok: false, accepted: false, reason: 'bridge_error', capability, message: String(error && error.message || error || '') }; }
  };
  const capabilities = Object.freeze({
    isNative,
    available: (name) => !!plugin(name),
    secureStorage: Object.freeze({
      get: (options) => call('secureStorage', 'SecureStorage', 'internalGetItem', options),
      set: (options) => call('secureStorage', 'SecureStorage', 'internalSetItem', options),
    }),
    filesystem: Object.freeze({
      write: (options) => call('filesystem', 'Filesystem', 'writeFile', options),
      read: (options) => call('filesystem', 'Filesystem', 'readFile', options),
    }),
    webdav: Object.freeze({ request: (options) => call('webdav', 'GuanjiDav', 'request', options) }),
    notifications: Object.freeze({
      requestPermissions: (options) => call('notifications', 'LocalNotifications', 'requestPermissions', options),
      schedule: (options) => call('notifications', 'LocalNotifications', 'schedule', options),
      cancel: (options) => call('notifications', 'LocalNotifications', 'cancel', options),
    }),
    widget: Object.freeze({ syncStats: (options) => call('widget', 'WidgetStats', 'syncStats', options) }),
    homeSnapshot: Object.freeze({
      read: (options) => call('homeSnapshot', 'NativeHomeSnapshot', 'readSnapshot', options),
      write: (options) => call('homeSnapshot', 'NativeHomeSnapshot', 'writeSnapshot', options),
    }),
    behaviorSnapshot: Object.freeze({
      request: (options) => call('behaviorSnapshot', 'BehaviorSnapshot', 'requestBehaviorSnapshot', options),
    }),
    roomShadow: Object.freeze({
      inspect: (options) => call('roomShadow', 'RoomShadow', 'inspect', options),
      loadRecords: (options) => call('roomShadow', 'RoomShadow', 'loadRecords', options),
      replaceRecords: (options) => call('roomShadow', 'RoomShadow', 'replaceRecords', options),
      migrateRecordBatch: (options) => call('roomShadow', 'RoomShadow', 'migrateRecordBatch', options),
      applyDelta: (options) => call('roomShadow', 'RoomShadow', 'applyDelta', options),
      close: (options) => call('roomShadow', 'RoomShadow', 'close', options),
    }),
    lifecycle: Object.freeze({
      addListener: (event, callback) => {
        const target = plugin('App');
        if (!target || typeof target.addListener !== 'function') return Promise.resolve({ ok: false, reason: 'unavailable' });
        return target.addListener(event, callback).catch(() => ({ ok: false, reason: 'bridge_error' }));
      },
    }),
    permissions: Object.freeze({
      requestNotifications: (options) => call('permissions', 'LocalNotifications', 'requestPermissions', options),
    }),
  });
  global.GuanjiNative = capabilities;
})(window);
