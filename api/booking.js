// POST /api/booking — a request for a paid feature. No payment is taken here.
const { endpoint, invalid, text, isUrl, EMAIL, HANDLE } = require('./_db');

module.exports = endpoint('POST', async (sql, d, res) => {
  const format = text(d.format, 10), username = text(d.username, 31).replace(/^@/, ''), email = text(d.email, 160).toLowerCase();
  const caption = text(d.caption, 2200), date = text(d.date, 10), time = text(d.time, 5), media = text(d.media, 500);
  const errors = {};
  if (!['story', 'post', 'reel'].includes(format)) errors.format = 'Choose a format.';
  if (!HANDLE.test(username)) errors.username = 'Enter an Instagram username, like @yourhandle.';
  if (!EMAIL.test(email)) errors.email = 'Enter an email address, like name@example.com.';
  if (caption.length < 3) errors.caption = 'Write the caption you want us to post.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date <= new Date().toISOString().slice(0, 10)) errors.date = 'Choose a date from tomorrow onwards.';
  if (!/^\d{2}:\d{2}$/.test(time)) errors.time = 'Choose a time.';
  if (!isUrl(media)) errors.media = 'Paste a link to your photo or reel, starting with https://.';
  if (d.own !== true) errors.own = 'Tick this box to confirm the work is your own.';
  if (d.label !== true) errors.label = 'Tick this box to continue.';
  if (Object.keys(errors).length) return invalid(res, errors);
  await sql`insert into bookings (format, username, email, caption, post_date, post_time, media_url)
            values (${format}, ${username}, ${email}, ${caption}, ${date}, ${time}, ${media})`;
  return res.status(200).json({ ok: true });
});
