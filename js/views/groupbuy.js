// Group Buying: its own place on the menu. Staff kit with the club's logo, ordered with other clubs every quarter
// (the form and live board are in js/shop/groupbuy-order.js). Paid by card in Shop & orders when the round closes.
import api from '../data.js';
import { head } from '../ui.js';

export default async function groupbuy(parts = []){
  const [m, c] = await Promise.all([import('../shop/groupbuy-order.js'), api.club()]);
  return head('Group Buying', 'Staff t-shirts and quarter zips with your club’s logo, ordered with other NGL clubs every quarter: the bigger the round, the lower the price.')
    + await m.default(c, parts.filter(Boolean));
}
