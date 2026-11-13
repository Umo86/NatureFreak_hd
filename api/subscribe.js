// POST /api/subscribe — newsletter sign-up.
const { endpoint, invalid, text, EMAIL } = require('./_db');

module.exports = endpoint('POST', async (sql, d, res) => {
  const email = text(d.email, 160).toLowerCase();
  if (!EMAIL.test(email)) return invalid(res, { email: 'Enter an email address, like name@example.com.' });
  await sql`insert into subscribers (email) values (${email}) on conflict (email) do nothing`;
  return res.status(200).json({ ok: true });
});
