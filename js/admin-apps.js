// Every NGL admin app, grouped like the original NGL Admin Hub (GYMNASTICS-RESULTS/NGL_Admin_Hub.html).
// 'to' = rebuilt in this app; otherwise the existing tool opens inside the app (it works on LIVE data, exactly as today).
export const GROUPS = [
  {id: 'office', name: 'Office', colour: '#28225C'},
  {id: 'comps', name: 'Competitions', colour: '#c6152e'},
  {id: 'clubs', name: 'Clubs and pathways', colour: '#14254a'},
  {id: 'money', name: 'Finance', colour: '#1f7a4d'}
];
export const APPS = [
 {
  "group": "office",
  "id": "email",
  "name": "Email assistant",
  "desc": "Replies Claude has drafted for admin@: check, edit and send them. Nothing goes until you press Send",
  "url": "https://davidcbrooke.github.io/GYMNASTICS-RESULTS/NGL_Email_Assistant.html",
  "icon": "<rect x=\"3\" y=\"5\" width=\"18\" height=\"14\" rx=\"2\"/><path d=\"M3 7l9 6 9-6\"/>"
 },
 {
  "group": "clubs",
  "id": "clubs",
  "name": "Club registrations",
  "desc": "Every club registered on the NGL Club Hub: newest first, contact details, where they came from and licences",
  "url": "https://club.nationalgymnasticsleague.co.uk/#admin",
  "icon": "<path d=\"M3 21h18M5 21V8l7-4 7 4v13\"/><path d=\"M9 21v-6h6v6\"/>",
  "to": "#/admin/clubs"
 },
 {
  "group": "comps",
  "id": "competitions",
  "name": "Competitions",
  "desc": "Competition dates, club bookings and the season calendar",
  "url": "https://davidcbrooke.github.io/GYMNASTICS-RESULTS/ngl-booking-system.html?admin=1",
  "icon": "<rect x=\"3\" y=\"5\" width=\"18\" height=\"16\" rx=\"2\"/><path d=\"M3 10h18M8 3v4M16 3v4\"/>",
  "to": "#/admin/competitions"
 },
 {
  "group": "comps",
  "id": "sales",
  "to": "#/admin/sales",
  "access": "finance",
  "name": "Ticket sales",
  "desc": "Gymnasts and spectators sold on JustGo for each competition, and places left",
  "url": "https://davidcbrooke.github.io/GYMNASTICS-RESULTS/NGL_Ticket_Sales.html",
  "icon": "<path d=\"M3 8a2 2 0 0 0 2-2h14a2 2 0 0 0 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 0-2 2H5a2 2 0 0 0-2-2v-2a2 2 0 0 0 0-4z\"/><path d=\"M14 6v12\" stroke-dasharray=\"2 2\"/>"
 },
 {
  "group": "comps",
  "id": "staffing",
  "to": "#/admin/staffing",
  "name": "Staffing",
  "desc": "Who's working each competition, judge requests and staffing sheets",
  "url": "https://davidcbrooke.github.io/GYMNASTICS-RESULTS/NGL_Staffing_Admin.html",
  "icon": "<circle cx=\"9\" cy=\"8\" r=\"3.5\"/><path d=\"M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6\"/><circle cx=\"17.5\" cy=\"9\" r=\"2.5\"/><path d=\"M16 14.2c3 .2 5.5 2.3 5.5 5.8\"/>"
 },
 {
  "group": "comps",
  "id": "planning",
  "to": "#/admin/planning",
  "access": "staffing",
  "name": "Competition planning",
  "desc": "Every job for each competition with its due date: what's due this week and what's overdue",
  "url": "https://davidcbrooke.github.io/GYMNASTICS-RESULTS/NGL_Comp_Planning.html",
  "icon": "<rect x=\"4\" y=\"4\" width=\"16\" height=\"17\" rx=\"2\"/><path d=\"M9 2v4M15 2v4M8 11l1.5 1.5L12 10M8 16.5l1.5 1.5 2.5-2.5M14 11.5h2.5M14 17h2.5\"/>"
 },
 {
  "group": "comps",
  "id": "judging",
  "to": "#/admin/judging",
  "name": "Judging",
  "desc": "Judging Pathway registrations, tiers and approvals",
  "url": "https://davidcbrooke.github.io/GYMNASTICS-RESULTS/ngl-judging-pathway.html?admin=1",
  "icon": "<rect x=\"5\" y=\"3\" width=\"14\" height=\"18\" rx=\"2\"/><path d=\"M9 3v3h6V3\"/><path d=\"M9 12l2 2 4-4M9 17h6\"/>"
 },
 {
  "group": "clubs",
  "id": "schools-lic",
  "colour": "#E0B800",
  "name": "Schools licences",
  "desc": "Schools Club Licences: invoices, mark paid, club codes and Graduations",
  "url": "https://nglschools.co.uk/club/?admin",
  "icon": "<path d=\"M2 9l10-5 10 5-10 5z\"/><path d=\"M6 11v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5\"/>",
  "to": "#/admin/clubs"
 },
 {
  "group": "clubs",
  "id": "rec-lic",
  "colour": "#E88230",
  "name": "Recreational licences",
  "desc": "Recreational Club Licences: invoices, mark paid and book orders",
  "url": "https://nglrecreational.co.uk/?admin",
  "icon": "<circle cx=\"12\" cy=\"9\" r=\"6\"/><path d=\"M8.5 14.5L7 22l5-3 5 3-1.5-7.5\"/>",
  "to": "#/admin/clubs"
 },
 {
  "group": "clubs",
  "id": "ps-lic",
  "colour": "#E5468F",
  "name": "Pre-School licences",
  "desc": "Pre-School Club Licences: orders and invoices, mark paid, mark supplies sent, and switch licences and lesson plan packs on or off",
  "url": "https://club.nationalgymnasticsleague.co.uk/preschool/club/?admin",
  "icon": "<circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z\"/>",
  "to": "#/admin/clubs"
 },
 {
  "group": "money",
  "id": "orders",
  "name": "Orders",
  "desc": "Every order from every pathway: paid, to post and not paid",
  "to": "#/admin/orders",
  "icon": "<path d=\"M6 7h12l-1 13H7z\"/><path d=\"M9 7a3 3 0 0 1 6 0\"/>"
 },
 {
  "group": "money",
  "id": "finance",
  "name": "Finance",
  "desc": "League P&L: competitions now, judging and licensing next",
  "url": "https://davidcbrooke.github.io/GYMNASTICS-RESULTS/NGL_Finance.html",
  "icon": "<path d=\"M16 6.5A4.5 4.5 0 0 0 8 9.5V13H6M8 13v3c0 1.5-1 3-2.5 3H18M6 13h8\"/>"
 },
 {
  "group": "money",
  "id": "projection",
  "access": "finance",
  "name": "Projected P&L",
  "desc": "10-year licensing projection: change the variables and save scenarios",
  "url": "https://davidcbrooke.github.io/GYMNASTICS-RESULTS/NGL_Projection.html",
  "icon": "<path d=\"M3 20h18\"/><path d=\"M5 16l4-5 4 3 6-8\"/><path d=\"M15 6h4v4\"/>"
 },
 {
  "group": "money",
  "id": "groupbuy",
  "name": "Group purchasing",
  "desc": "Quarterly club orders: staff t-shirts and merchandise, supplier totals and delivery addresses",
  "url": "https://davidcbrooke.github.io/GYMNASTICS-RESULTS/ngl-group-order.html?admin=1",
  "icon": "<path d=\"M3 7l3-3h3a3 3 0 0 0 6 0h3l3 3-3 4-2-1v10H8V10l-2 1z\"/>"
 },
 {
  "group": "comps",
  "id": "music",
  "name": "Floor music",
  "desc": "Club music uploads and downloads in floor running order",
  "url": "https://davidcbrooke.github.io/GYMNASTICS-RESULTS/NGL_Music_Admin.html",
  "icon": "<path d=\"M9 18V5l11-2v13\"/><circle cx=\"6\" cy=\"18\" r=\"3\"/><circle cx=\"17\" cy=\"16\" r=\"3\"/>",
  "to": "#/admin/music"
 },
 {
  "group": "comps",
  "id": "musicplayer",
  "to": "#/admin/musicplayer",
  "access": "music",
  "name": "Competition music player",
  "desc": "Play floor music in running order on the day, offline, with announcements",
  "url": "https://davidcbrooke.github.io/GYMNASTICS-RESULTS/NGL_Music_Admin.html#play",
  "icon": "<circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M10 8.5v7l6-3.5z\"/>"
 },
 {
  "group": "comps",
  "id": "results",
  "to": "#/admin/results",
  "name": "Results",
  "desc": "Result corrections and data quality",
  "url": "https://davidcbrooke.github.io/GYMNASTICS-RESULTS/admin-corrections.html",
  "icon": "<path d=\"M8 4h8v5a4 4 0 0 1-8 0z\"/><path d=\"M8 6H5a3 3 0 0 0 4 4M16 6h3a3 3 0 0 1-4 4\"/><path d=\"M12 13v4M8 21h8M9.5 21l.5-4h4l.5 4\"/>"
 },
 {
  "group": "clubs",
  "id": "powerleague",
  "colour": "#0071B3",
  "name": "Training League",
  "desc": "Add gymnasts to the Training League and enter their checked challenge results; the public league table updates straight away",
  "url": "https://davidcbrooke.github.io/GYMNASTICS-RESULTS/ngl-training-league.html?admin=1",
  "icon": "<path d=\"M13 2L4 14h7l-1 8 9-12h-7z\"/>"
 },
 {
  "group": "clubs",
  "id": "gl-hub",
  "access": "results",
  "colour": "#0071B3",
  "name": "General League Hub: view as gymnast",
  "desc": "Search any gymnast and see their General League Hub exactly as their family will, read-only",
  "url": "https://davidcbrooke.github.io/GYMNASTICS-RESULTS/ngl-general-league-hub-demo.html?admin=1",
  "icon": "<rect x=\"5\" y=\"3\" width=\"14\" height=\"18\" rx=\"2\"/><circle cx=\"12\" cy=\"10\" r=\"3\"/><path d=\"M8.5 17c.6-1.8 2-3 3.5-3s2.9 1.2 3.5 3\"/>"
 },
 {
  "group": "clubs",
  "id": "rotation",
  "name": "Rotation Planner clubs",
  "desc": "Registered clubs and data imports for the Rotation Planner",
  "url": "https://davidcbrooke.github.io/GYMNASTICS-RESULTS/NGL_Admin.html",
  "icon": "<path d=\"M20 12a8 8 0 1 1-2.3-5.7\"/><path d=\"M20 4v5h-5\"/>"
 }
];

// Which ticks open each rebuilt screen (must match clubsTeam(), ordersTeam() ... in firestore.rules)
export const SCREENS = {
  clubs: ['clubs', 'schools-lic', 'rec-lic', 'ps-lic'],
  orders: ['orders', 'schools-lic', 'rec-lic', 'ps-lic', 'finance'],
  competitions: ['competitions'],
  music: ['music']
};
export const can = (me, ids) => !!me && (!!me.owner || [].concat(ids).some(i => (me.sections || []).includes(i)));
export const canApp = (me, a) => can(me, a.id === 'orders' ? SCREENS.orders : [a.id].concat(a.access ? [a.access] : []));
