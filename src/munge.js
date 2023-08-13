/**
 * @private
 * @param {string} s
 * @return {string}
 */
export function munge(s) {
  return s.toLowerCase()
      .replace(/'/g, '')
      .replace(/ /g, '')
      .replace(/\+/g, '');
}
