// POST /api/contact — a message from the contact page.
const { endpoint, invalid, text, EMAIL } = require('./_db');
const TOPICS = ['question', 'listing', 'feature', 'correction', 'press', 'advertising'];

module.exports = endpoint('POST', async (sql, d, res) => {
  const name = text(d.name, 80), email = text(d.email, 160).toLowerCase(), message = text(d.message, 4000);
  const topic = TOPICS.includes(d.topic) ? d.topic : 'question';
  const errors = {};
  if (name.length < 2) errors.name = 'Enter your name.';
  if (!EMAIL.test(email)) errors.email = 'Enter an email address, like name@example.com.';
  if (message.length < 10) errors.message = 'Write your message (at least 10 characters).';
  if (Object.keys(errors).length) return invalid(res, errors);
  await sql`insert into messages (name, email, topic, message) values (${name}, ${email}, ${topic}, ${message})`;
  return res.status(200).json({ ok: true });
});
