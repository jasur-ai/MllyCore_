// =============================================
// MllyCore SVG Icon Library v2.0
// Professional SVG icons for the entire platform
// =============================================
// Usage:
//   window.Icon('checkmark')             → SVG string
//   window.Icon.render('checkmark')      → DOM element
//   window.Icon.prepend(el, 'checkmark') → prepend icon to element
//   window.Icon.replaceText('✅ Done')    → 'svg… Done'
//   window.Icon.scan()                   → auto-replace emojis in all text nodes
// =============================================

(function () {
  'use strict';

  // =============================================
  // ICON PATHS (Lucide-style, 24×24, currentColor)
  // =============================================
  var ICONS = {
    // Navigation & Layout
    home:        '<path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>',
    dashboard:   '<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
    sidebar:     '<path d="M4 6h16M4 12h16M4 18h16"/>',
    close:       '<path d="M18 6L6 18M6 6l12 12"/>',
    arrowLeft:   '<path d="M19 12H5M12 19l-7-7 7-7"/>',
    arrowRight:  '<path d="M5 12h14M12 5l7 7-7 7"/>',
    arrowDown:   '<path d="M12 5v14M5 12l7 7 7-7"/>',
    arrowUp:     '<path d="M12 19V5M5 12l7-7 7 7"/>',
    chevronDown: '<path d="M6 9l6 6 6-6"/>',
    chevronUp:   '<path d="M6 15l6-6 6 6"/>',
    chevronLeft: '<path d="M15 18l-6-6 6-6"/>',
    chevronRight:'<path d="M9 18l6-6-6-6"/>',
    moreVertical:'<circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/>',
    moreHorizontal:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
    menu:        '<path d="M4 6h16M4 12h16M4 18h16"/>',
    external:    '<path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3"/>',

    // Actions
    plus:        '<path d="M12 5v14M5 12h14"/>',
    minus:       '<path d="M5 12h14"/>',
    edit:        '<path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>',
    trash:       '<path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>',
    copy:        '<rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>',
    save:        '<path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17,21 17,13 7,13 7,21"/><polyline points="7,3 7,8 15,8"/>',
    search:      '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
    filter:      '<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>',
    download:    '<path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
    upload:      '<path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
    refresh:     '<polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/>',
    undo:        '<polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/>',
    settings:    '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.32 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/>',
    logOut:      '<path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/>',
    logIn:       '<path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M10 17l5-5-5-5M15 12H3"/>',
    pin:         '<path d="M16 3l4 4L9 18l-5 1 1-5L16 3z"/>',

    // Status & Feedback
    checkmark:   '<polyline points="20 6 9 17 4 12"/>',
    cross:       '<path d="M18 6L6 18M6 6l12 12"/>',
    alertCircle: '<circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>',
    alertTriangle:'<path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
    info:        '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>',
    helpCircle:  '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>',

    // Communication
    message:     '<path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>',
    messageSquare:'<rect x="3" y="3" width="18" height="14" rx="2" ry="2"/><line x1="8" y1="10" x2="16" y2="10"/>',
    mail:        '<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>',
    send:        '<line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>',
    bell:        '<path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/>',
    bellOff:     '<path d="M13.73 21a2 2 0 01-3.46 0M18.63 13A17.888 17.888 0 0118 8M6.26 6.26A5.86 5.86 0 006 8c0 7-3 9-3 9h14M1 1l22 22"/>',
    chat:        '<path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>',

    // Users
    user:        '<path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    users:       '<path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>',
    userPlus:    '<path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/>',
    userCheck:   '<path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="8.5" cy="7" r="4"/><polyline points="17 11 19 13 23 9"/>',
    userX:       '<path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="18" y1="8" x2="23" y2="13"/><line x1="23" y1="8" x2="18" y2="13"/>',
    crown:       '<path d="M2 19l4-14 6 8 6-8 4 14"/><path d="M2 19h20"/>',

    // Content & Files
    file:        '<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>',
    fileText:    '<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10,9 9,9 8,9"/>',
    folder:      '<path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>',
    clipboard:   '<path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>',
    list:        '<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>',
    grid:        '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>',
    columns:     '<path d="M12 3h7a2 2 0 012 2v14a2 2 0 01-2 2h-7m0-18H5a2 2 0 00-2 2v14a2 2 0 002 2h7m0-18v18"/>',
    layers:      '<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>',
    link:        '<path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>',
    paperclip:   '<path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/>',
    lock:        '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>',
    unlock:      '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 019.9-1"/>',
    key:         '<path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>',
    eye:         '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
    eyeOff:      '<path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24M1 1l22 22"/>',
    image:       '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>',
    camera:      '<path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/>',

    // Analytics & Data
    barChart:    '<line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/>',
    pieChart:    '<path d="M21.21 15.89A10 10 0 118 2.83M22 12A10 10 0 0012 2v10z"/>',
    trendUp:     '<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>',
    trendDown:   '<polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/>',
    activity:    '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>',
    target:      '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
    award:       '<circle cx="12" cy="8" r="6"/><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/>',
    star:        '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',

    // Business
    briefcase:   '<rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16"/>',
    dollarSign:  '<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>',
    creditCard:  '<rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/>',
    shoppingCart:'<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/>',
    gift:        '<polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z"/>',

    // Development
    code:        '<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>',
    terminal:    '<polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/>',
    gitBranch:   '<line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 01-9 9"/>',
    gitCommit:   '<circle cx="12" cy="12" r="4"/><line x1="1.05" y1="12" x2="7" y2="12"/><line x1="17.01" y1="12" x2="22.96" y2="12"/>',
    gitPullRequest:'<circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M13 6h3a2 2 0 012 2v7"/><line x1="6" y1="9" x2="6" y2="21"/>',
    database:    '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>',
    cloud:       '<path d="M18 10h-1.26A8 8 0 109 20h9a5 5 0 000-10z"/>',
    server:      '<rect x="3" y="3" width="18" height="6" rx="1"/><rect x="3" y="10" width="18" height="6" rx="1"/><rect x="3" y="17" width="18" height="6" rx="1"/>',

    // Misc
    globe:       '<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/>',
    map:         '<polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/>',
    calendar:    '<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
    clock:       '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
    watch:       '<circle cx="12" cy="12" r="7"/><polyline points="12 9 12 12 13.5 13.5"/><path d="M16.51 17.35l-.35 3.83a2 2 0 01-2 1.82H9.83a2 2 0 01-2-1.82l-.35-3.83m.01-10.7l.35-3.83A2 2 0 019.83 1h4.35a2 2 0 012 1.82l.35 3.83"/>',
    shield:      '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
    zap:         '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
    bookmark:    '<path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/>',
    tag:         '<path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/>',
    flag:        '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/>',
    inbox:       '<polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z"/>',
    package:     '<line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 002 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>',
    compass:     '<circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>',
    smile:       '<circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/>',
    thumbsUp:    '<path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-3.3zM7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3"/>',
    thumbsDown:  '<path d="M10 15v4a3 3 0 003 3l4-9V2H5.72a2 2 0 00-2 1.7l-1.38 9a2 2 0 002 3.3zM7 2H4a2 2 0 00-2 2v7a2 2 0 002 2h3"/>',
    headset:     '<path d="M4 14h2v4H4a2 2 0 01-2-2v-2a2 2 0 012-2h2v-2a6 6 0 0112 0v2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2v-4h-2v-2a4 4 0 00-8 0v2H4z"/><path d="M18 18v2a2 2 0 01-2 2h-2"/>',
    tool:        '<path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/>',
    cpu:         '<rect x="4" y="4" width="16" height="16" rx="1"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/><line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="14" x2="23" y2="14"/><line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="14" x2="4" y2="14"/>',
    wifi:        '<path d="M5 12.55a11 11 0 0114.08 0"/><path d="M1.42 9a16 16 0 0121.16 0"/><path d="M8.53 16.11a6 6 0 016.95 0"/><circle cx="12" cy="20" r="1"/>',

    // MllyCore specific
    workspace:   '<rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/>',
    idea:        '<path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/><circle cx="12" cy="12" r="10"/>',
    rocket:      '<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 00-2.91-.09z"/><path d="M12 15l-3-3a22 22 0 012-3.95A12.88 12.88 0 0122 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 01-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>',
    lightbulb:   '<path d="M9.09 9.78h5.82A6.07 6.07 0 0112 3a6.07 6.07 0 00-2.91 6.78z"/><path d="M9 12h6"/><path d="M10 15h4"/><path d="M11 18h2"/>',
    heart:       '<path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>',
    anchor:      '<circle cx="12" cy="5" r="3"/><line x1="12" y1="8" x2="12" y2="22"/><path d="M5 15H3a9 9 0 0018 0h-2"/>',
    palette:     '<circle cx="13.5" cy="6.5" r="1.5"/><circle cx="17.5" cy="10.5" r="1.5"/><circle cx="17.5" cy="14.5" r="1.5"/><circle cx="13.5" cy="18.5" r="1.5"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c1.1 0 2-.9 2-2 0-.5-.2-1-.5-1.4-.3-.4-.5-.9-.5-1.4 0-1.1.9-2 2-2h3c3.3 0 6-2.7 6-6 0-5.5-4.5-10-10-10z"/>',
    smartphone:  '<rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/>',
    monitor:     '<rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>',
    graduationCap:'<path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>',
    starHalf:    '<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77V2z"/>',

    // MllyCore Brand
    mllycore:    '<path d="M3 20V5l6 10 3-6 3 6 6-10v15" stroke-width="2.5"/>',
    mllycoreFill:'<path d="M3 20V5l6 10 3-6 3 6 6-10v15" fill="currentColor" stroke="none"/>',

    // Workspace & Project Management
    kanban:      '<line x1="4" y1="3" x2="4" y2="21"/><line x1="12" y1="3" x2="12" y2="21"/><line x1="20" y1="3" x2="20" y2="21"/><rect x="2" y="3" width="4" height="3" rx=".5"/><rect x="10" y="3" width="4" height="6" rx=".5"/><rect x="18" y="3" width="4" height="4" rx=".5"/>',
    sprint:      '<circle cx="12" cy="12" r="9"/><polyline points="13 8 13 12 16 14"/><path d="M9 3l3-3 3 3"/><polyline points="21 10 22 12 21 14"/>',
    backlog:     '<rect x="4" y="5" width="16" height="4" rx="1"/><rect x="4" y="12" width="12" height="4" rx="1"/><rect x="4" y="19" width="8" height="4" rx="1"/>',
    milestone:   '<path d="M4 21V4h14l-3 5 3 5H4"/><circle cx="19" cy="15" r="4"/><polyline points="17 15 19 17 23 13"/>',
    retros:      '<circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/><path d="M19 16l2 3-3 2"/><path d="M5 16l-2 3 3 2"/>',

    // Team & Communication
    standup:     '<circle cx="9" cy="7" r="3"/><path d="M3 21v-2a4 4 0 015-3.8"/><circle cx="15" cy="8" r="2.5"/><path d="M12 21v-2.5a5 5 0 016-4.7"/><path d="M21 21v-2a3 3 0 00-1.5-2.6"/>',
    feedback:    '<path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/><polygon points="12 7 13.2 9.5 16 9.8 14 11.7 14.5 14.5 12 13.2 9.5 14.5 10 11.7 8 9.8 10.8 9.5 12 7"/>',
    onboarding:  '<rect x="3" y="3" width="18" height="18" rx="2"/><polyline points="9 12 11 14 15 10"/><line x1="3" y1="8" x2="21" y2="8"/><circle cx="18" cy="18" r="3"/><line x1="18" y1="16.5" x2="18" y2="19.5"/><line x1="16.5" y1="18" x2="19.5" y2="18"/>',
    notes:       '<path d="M4 21V5a2 2 0 012-2h10l4 4v14a2 2 0 01-2 2H6a2 2 0 01-2-2z"/><polyline points="14 3 14 9 20 9"/><line x1="8" y1="14" x2="16" y2="14"/><line x1="8" y1="18" x2="13" y2="18"/>',
    docs:        '<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M16 13H8M16 17H8M10 9H8"/>',

    // Strategy & Analytics
    roadmap:     '<polyline points="2 18 7 12 12 15 22 6"/><circle cx="7" cy="12" r="2"/><circle cx="12" cy="15" r="2"/><circle cx="22" cy="6" r="2"/><line x1="2" y1="4" x2="2" y2="22"/><line x1="22" y1="3" x2="22" y2="22"/>',
    insights:    '<path d="M10 10a3 3 0 115 0c0 2-3 3-3 5"/><line x1="12" y1="18" x2="12" y2="20"/><path d="M9 20h6"/><polyline points="4 5 8 9 12 6 16 10"/>',
    teamGoal:    '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/><path d="M7 9l-3-3"/><path d="M17 9l3-3"/><path d="M7.5 19.5L6 21"/><path d="M16.5 19.5L18 21"/>',
    integration: '<rect x="2" y="6" width="8" height="12" rx="1.5"/><rect x="14" y="6" width="8" height="12" rx="1.5"/><path d="M10 12h4"/><circle cx="10" cy="9" r="1" fill="currentColor" stroke="none"/><circle cx="14" cy="15" r="1" fill="currentColor" stroke="none"/>',
    analytics:   '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/><line x1="3" y1="21" x2="21" y2="21"/>',
  };

  // =============================================
  // EMOJI → ICON NAME MAP for auto-replacement
  // =============================================
  var EMOJI_MAP = {
    '✅': 'checkmark',   '❌': 'cross',        '⚠️': 'alertTriangle',
    '🔒': 'lock',        '🔓': 'unlock',       '🔑': 'key',
    '🔐': 'lock',        '🔎': 'search',       '🔍': 'search',
    '📋': 'clipboard',   '📊': 'barChart',     '📝': 'edit',
    '📌': 'pin',         '📎': 'paperclip',    '📁': 'folder',
    '📂': 'folder',      '🗂️':'folder',       '📄': 'file',
    '📑': 'fileText',    '📃': 'fileText',     '📜': 'fileText',
    '🧾': 'fileText',    '📰': 'fileText',     '💡': 'lightbulb',
    '💬': 'message',     '🗨️':'message',      '💭': 'messageSquare',
    '👥': 'users',       '👤': 'user',         '👁': 'eye',
    '👀': 'eye',         '🎯': 'target',       '🚀': 'rocket',
    '🔥': 'zap',         '⭐': 'star',         '🌟': 'star',
    '✨': 'star',        '💎': 'star',         '🏆': 'award',
    '🥇': 'award',       '🏅': 'award',        '🎉': 'award',
    '🎊': 'award',       '💰': 'dollarSign',   '💵': 'dollarSign',
    '💳': 'creditCard',  '🏠': 'home',         '🏢': 'briefcase',
    '💼': 'briefcase',   '📈': 'trendUp',      '📉': 'trendDown',
    '🔄': 'refresh',     '🔃': 'refresh',      '♻️':'refresh',
    '🔔': 'bell',        '🔕': 'bellOff',      '📤': 'upload',
    '📥': 'download',    '🔗': 'link',         '🔧': 'tool',
    '🛠': 'tool',        '⚙️':'settings',      '🗺': 'map',
    '🗺️':'map',         '🌍': 'globe',        '🌐': 'globe',
    '📡': 'activity',    '💻': 'terminal',     '🐙': 'gitBranch',
    '📱': 'smartphone',  '🖥️':'monitor',      '🗄️':'database',
    '💿': 'database',    '☁️':'cloud',         '🎨': 'palette',
    '📅': 'calendar',    '📆': 'calendar',     '⏰': 'clock',
    '🕐': 'clock',       '🕒': 'clock',        '🛡️':'shield',
    '🎓': 'graduationCap','💪': 'zap',         '🧠': 'lightbulb',
    '🏷️':'tag',         '🔖': 'bookmark',     '📏': 'ruler',
    '📐': 'ruler',       '🧩': 'puzzle',       '♟️':'strategy',
    '🎮': 'gamepad',     '🖼️':'image',        '📸': 'camera',
    '🎬': 'video',       '📺': 'monitor',      '📻': 'headset',
    '🎙️':'headset',     '📨': 'send',         '✉️':'mail',
    '💌': 'mail',        '🗳️':'inbox',        '📦': 'package',
    '🎁': 'gift',        '🎒': 'package',      '👔': 'userCheck',
    '👑': 'crown',       '💺': 'user',         '💻': 'terminal',
    '🔬': 'search',      '🔭': 'search',       '🧑‍💻':'code',
    '🆕': 'plus',        '➕': 'plus',         '➖': 'minus',
    '✖️':'cross',        '➗': 'divide',        '♾️':'infinity',
    '💯': 'checkmark',   '❓': 'helpCircle',   'ℹ️':'info',
    '🟢': 'checkmark',   '🔴': 'cross',         '🟡': 'alertTriangle',
    '✅': 'checkmark',   '❌': 'cross',         '📣': 'send',
    '📢': 'bell',        '🔊': 'bell',          '💾': 'save',
    '⬆️':'upload',       '⬇️':'download',       '➡️':'arrowRight',
    '⬅️':'arrowLeft',    '⬆':'upload',          '⬇':'download',
    '🗑️':'trash',        '✏️':'edit',           '📷': 'camera',
    '🎤': 'microphone',  '🎧': 'headset',       '🎵': 'music',
    '🎶': 'music',       '🏃': 'running',       '🧑':'user',
    '🛒': 'shoppingCart', '🎟️':'ticket',        '📫': 'inbox',
    '📪': 'inbox',       '📍': 'pin',           '📌': 'pin',
    '🧑‍🤝‍🧑':'users',    '👨‍👩‍👧‍👦':'users',    '🌙': 'moon',
    '☀️':'sun',         '☔': 'umbrella',       '☃️':'snowflake',
    '🎄': 'tree',        '🎃': 'pumpkin',       '🕯️':'candle',
    '📘': 'book',        '📕': 'book',          '📗': 'book',
    '🔋': 'battery',     '📲': 'smartphone',    '🖨️':'printer',
    '⌨️':'keyboard',     '🖱️':'mouse',         '💽': 'database',
    '⏳': 'clock',        '⌛': 'clock',         '🚩': 'flag',
    '🎌': 'flag',        '🏁': 'flag',          '🚦': 'trafficLight',
    '🚧': 'construction','⛔': 'blocked',       '🚫': 'blocked',
    '🅿️':'parking',      '♿': 'accessible',    '🚻': 'restroom',
    '🚹': 'men',         '🚺': 'women',         '🛗': 'elevator',
    '🗣️':'message',      '👋': 'wave',          '🤝': 'handshake',
    '👍': 'thumbsUp',    '👎': 'thumbsDown',    '👏': 'clap',
    '🙌': 'celebration', '🎈': 'balloon',       '🎀': 'ribbon',
    '🕶️':'glasses',      '👓': 'glasses',       '👟': 'shoe',
    '👕': 'shirt',       '🧥': 'coat',          '🩺': 'stethoscope',
    '⚕️':'heart',        '🏥': 'hospital',      '🏦': 'bank',
    '⛽': 'fuel',        '🛒': 'shoppingCart',  '🏪': 'store',
    '🏫': 'school',      '📚': 'books',         '🏛️':'building',
    '🗿': 'statue',       '🗽': 'statue',        '🗼': 'tower',
    '🎡': 'ferrisWheel', '🎢': 'rollerCoaster','🎠': 'carousel',
    '⛰️':'mountain',     '🏔️':'mountain',      '🗻': 'mountain',
    '🏝️':'island',       '🏖️':'beach',         '🏜️':'desert',
    '🌋': 'volcano',     '🌊': 'wave',          '🌈': 'rainbow',
    '⛄': 'snowflake',   '❄️':'snowflake',      '🔥': 'fire',
    '💧': 'droplet',     '🌱': 'seedling',      '🌿': 'plant',
    '🍀': 'clover',      '🌺': 'flower',        '🌸': 'flower',
    '🌻': 'flower',      '🌹': 'flower',        '🌷': 'flower',
    '🌲': 'tree',        '🌳': 'tree',          '🌴': 'palm',
    '🍎': 'apple',       '🍊': 'orange',        '🍋': 'lemon',
    '🍌': 'banana',      '🍇': 'grapes',        '🍓': 'strawberry',
    '🍔': 'hamburger',   '🍕': 'pizza',         '🌮': 'taco',
    '🍿': 'popcorn',     '🥤': 'drink',         '☕': 'coffee',
    '🍵': 'tea',         '🍺': 'beer',          '🥂': 'champagne',
    '🏓': 'pingpong',    '🏸': 'badminton',     '⚽': 'soccer',
    '🏀': 'basketball',  '🏈': 'football',      '⚾': 'baseball',
    '🎾': 'tennis',      '🏐': 'volleyball',    '🎱': 'billiards',
    '🛴': 'scooter',     '🚲': 'bicycle',       '🏍️':'motorcycle',
    '🚗': 'car',         '🚕': 'taxi',          '🚌': 'bus',
    '🚃': 'train',       '✈️':'airplane',       '🚁': 'helicopter',
    '🛸': 'ufo',         '🚀': 'rocket',        '🛰️':'satellite',
    '🧭': 'compass',     '🌡️':'thermometer',   '🧲': 'magnet',
    '🔭': 'telescope',    '🔬': 'microscope',    '🪐': 'planet',
    '📭': 'inbox',       '🗓️':'calendar',    '🕐': 'clock',
    '🕑': 'clock',       '🕒': 'clock',       '🕓': 'clock',
    '🕔': 'clock',       '🕕': 'clock',       '🕖': 'clock',
    '🕗': 'clock',       '🕘': 'clock',       '🕙': 'clock',
    '🕚': 'clock',       '🕛': 'clock',       '📖': 'book',
    // Workspace & Project Management emoji (unique, no conflicts with original map)
    '🏗️': 'kanban',    '📓': 'notes',       '🤖': 'integration',
  };

  // =============================================
  // RENDER FUNCTIONS
  // =============================================

  /**
   * Render an icon as an SVG string.
   *
   * @param {string} name - Icon key name from the ICONS registry (e.g. 'checkmark', 'user', 'mllycore')
   * @param {number} [size=16] - Width and height of the SVG in pixels
   * @param {string} [className=''] - Additional CSS class(es) to append to the SVG element
   * @returns {string} SVG markup string, or empty string if the icon name is not found
   */
  function icon(name, size, className) {
    var paths = ICONS[name];
    if (!paths) return '';
    var s = size || 16;
    var cls = className || '';
    return '<svg width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon icon-' + name + ' ' + cls + '">' + paths + '</svg>';
  }

  /**
   * Render an icon as a real DOM SVG element.
   *
   * @param {string} name - Icon key name from the ICONS registry
   * @param {number} [size=16] - Width and height in pixels
   * @param {string} [className=''] - Additional CSS class(es)
   * @returns {SVGSVGElement|null} The SVG DOM element, or null if the icon name is invalid
   */
  function iconRender(name, size, className) {
    var html = icon(name, size, className);
    if (!html) return null;
    var div = document.createElement('div');
    div.innerHTML = html;
    return div.firstElementChild;
  }

  /**
   * Prepend an SVG icon as the first child of a DOM element.
   *
   * @param {Element|null} el - The target DOM element
   * @param {string} name - Icon key name
   * @param {number} [size=16] - Width and height in pixels
   * @returns {Element|null} The original element for chaining, or null if el was null
   */
  function iconPrepend(el, name, size) {
    if (!el) return el;
    var svg = iconRender(name, size || 16);
    if (svg) el.insertBefore(svg, el.firstChild);
    return el;
  }

  /**
   * Replace emoji characters in a text string with inline SVG icons.
   * Uses a single-pass regex replacement (O(n)) for maximum performance.
   *
   * @param {string} text - The input string possibly containing emoji characters
   * @param {number} [size=16] - Width and height of the replacement icons in pixels
   * @returns {string} The string with emoji replaced by SVG markup, or the original value if not a string
   */
  /** Cache the emoji regex so we build it only once */
  var _emojiRe = null;
  function iconReplaceText(text, size) {
    if (!text || typeof text !== 'string') return text;
    size = size || 16;
    // Build regex once, then reuse
    if (!_emojiRe) {
      var keys = Object.keys(EMOJI_MAP).sort(function (a, b) { return b.length - a.length; });
      if (!keys.length) return text;
      var escaped = [];
      for (var i = 0; i < keys.length; i++) {
        escaped.push(keys[i].replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
      }
      _emojiRe = new RegExp(escaped.join('|'), 'g');
    }
    return text.replace(_emojiRe, function (match) {
      return icon(EMOJI_MAP[match], size);
    });
  }

  // =============================================
  // AUTO-SCAN: Replace emojis in all text nodes
  // =============================================

  var _scanned = false;
  var _scanning = false; // reentrancy guard
  var _ignoreTags = { SCRIPT: true, STYLE: true, TEXTAREA: true, INPUT: true, SELECT: true, OPTION: true, SVG: true, CODE: true, PRE: true, NOSCRIPT: true };

  /**
   * Walk all text nodes within a DOM subtree and replace emoji characters with
   * inline SVG icons. Skips tags listed in _ignoreTags (SCRIPT, STYLE, SVG, etc.).
   *
   * @param {Element|Document} root - The root element or document to scan
   * @param {number} [size=16] - Width and height of replacement icons in pixels
   * @returns {void}
   */
  function scanElement(root, size) {
    size = size || 16;
    var walker = document.createTreeWalker(
      root,
      4, // NodeFilter.SHOW_TEXT
      null,
      false
    );
    var node;
    var nodesToReplace = [];
    while ((node = walker.nextNode())) {
      var parentTag = node.parentNode ? node.parentNode.tagName : '';
      if (_ignoreTags[parentTag]) continue;
      var text = node.nodeValue || '';
      if (text.length < 1) continue;
      // Quick check: does it contain any emoji?
      var hasEmoji = false;
      for (var emoji in EMOJI_MAP) {
        if (text.indexOf(emoji) !== -1) {
          hasEmoji = true;
          break;
        }
      }
      if (!hasEmoji) continue;
      // Replace the text node with a DocumentFragment
      var parts = [];
      var remaining = text;
      var keys = Object.keys(EMOJI_MAP).sort(function (a, b) { return b.length - a.length; });
      while (remaining.length > 0) {
        var bestEmoji = null;
        var bestIdx = -1;
        for (var k = 0; k < keys.length; k++) {
          var idx = remaining.indexOf(keys[k]);
          if (idx !== -1 && (bestIdx === -1 || idx < bestIdx)) {
            bestIdx = idx;
            bestEmoji = keys[k];
          }
        }
        if (bestEmoji === null) {
          parts.push(document.createTextNode(remaining));
          break;
        }
        if (bestIdx > 0) {
          parts.push(document.createTextNode(remaining.substring(0, bestIdx)));
        }
        // Create SVG element for the emoji
        var svgEl = iconRender(EMOJI_MAP[bestEmoji], size);
        if (svgEl) {
          svgEl.style.verticalAlign = '-0.15em';
          parts.push(svgEl);
        }
        remaining = remaining.substring(bestIdx + bestEmoji.length);
      }
      if (parts.length > 1 || (parts.length === 1 && parts[0].nodeType !== 3)) {
        var fragment = document.createDocumentFragment();
        for (var p = 0; p < parts.length; p++) {
          fragment.appendChild(parts[p]);
        }
        nodesToReplace.push({ old: node, fragment: fragment });
      }
    }
    // Apply replacements outside the walker loop to avoid mutation issues
    for (var r = 0; r < nodesToReplace.length; r++) {
      try {
        nodesToReplace[r].old.parentNode.replaceChild(nodesToReplace[r].fragment, nodesToReplace[r].old);
      } catch (_) {}
    }
  }

  /**
   * Perform a full-document scan: replace all emoji characters in visible text
   * nodes within document.body with inline SVG icons.
   *
   * @param {number} [size=16] - Width and height of replacement icons in pixels
   * @returns {void}
   */
  function scanDocument(size) {
    scanElement(document.body, size || 16);
    _scanned = true;
  }

  // =============================================
  // MUTATION OBSERVER for dynamic content
  // =============================================

  var _observer = null;
  /**
   * Start a MutationObserver that watches for new DOM nodes being added.
   * When new content appears, it automatically runs scanElement on the
   * inserted subtrees (debounced at 50ms) to replace any emoji with icons.
   *
   * @param {number} [size=16] - Width and height of replacement icons in pixels
   * @returns {void}
   */
  function startObserver(size) {
    if (_observer) return;
    var obsSize = size || 16;
    _observer = new MutationObserver(function (mutations) {
      if (_scanning) return; // skip if scan is in progress
      var roots = [];
      for (var i = 0; i < mutations.length; i++) {
        var added = mutations[i].addedNodes;
        if (added) {
          for (var j = 0; j < added.length; j++) {
            // Only scan elements (text nodes don't have children to recurse into)
            if (added[j].nodeType === 1) {
              roots.push(added[j]);
            }
          }
        }
      }
      if (roots.length === 0) return;
      clearTimeout(_observer._timer);
      _observer._timer = setTimeout(function () {
        // Scan only the newly added subtrees (more efficient than full body scan)
        for (var k = 0; k < roots.length; k++) {
          if (document.body.contains(roots[k])) {
            scanElement(roots[k], obsSize);
          }
        }
      }, 50);
    });
    _observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  // =============================================
  // AUTO-RUN on DOMContentLoaded
  // =============================================

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      scanDocument();
      startObserver();
    });
  } else {
    scanDocument();
    startObserver();
  }

  // =============================================
  // EXPORT PUBLIC API
  // =============================================

  window.Icon = icon;
  window.Icon.render = iconRender;
  window.Icon.prepend = iconPrepend;
  window.Icon.replaceText = iconReplaceText;
  window.Icon.scan = scanDocument;
  window.Icon.scanElement = scanElement;

  /**
   * Stop the MutationObserver and clean up resources.
   * Call this when leaving a page or destroying a component to prevent
   * memory leaks in single-page applications (SPA).
   *
   * @returns {void}
   */
  window.Icon.stop = function () {
    if (_observer) {
      _observer.disconnect();
      _observer = null;
    }
  };

  /**
   * Disconnect and restart the observer (useful after dynamic route changes).
   *
   * @param {number} [size=16] - Width and height of replacement icons in pixels
   * @returns {void}
   */
  window.Icon.restart = function (size) {
    if (_observer) { _observer.disconnect(); _observer = null; }
    scanDocument(size);
    startObserver(size);
  };

  // Legacy compat: data-icon attribute auto-replace (for manually marked elements)
  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('[data-icon]').forEach(function (el) {
      var html = el.innerHTML;
      var replaced = iconReplaceText(html, parseInt(el.dataset.iconSize) || 16);
      if (replaced !== html) el.innerHTML = replaced;
    });
  });

})();
