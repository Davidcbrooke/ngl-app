// NGL Admin · Competition music player: the Play tab of Floor music (js/admin/music.js), opened straight away.
// Same as the original Admin Hub tile, which opened NGL_Music_Admin.html#play. Uses css/admin-music.css.
import music, { MU } from './music.js';
export { MU };
export default (me, parts = []) => music(me, ['play', ...parts]);
