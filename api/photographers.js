// GET /api/photographers — approved listings (never includes email addresses). ?id=<slug> returns one.
const { endpoint, text } = require('./_db');

module.exports = endpoint('GET', async (sql, q, res) => {
  const id = text(q.id, 60);
  if (id) {
    const rows = await sql`select slug, name, location, specialisms, for_hire, instagram, website, bio
                           from photographers where slug = ${id} and status = 'approved' limit 1`;
    if (!rows.length) return res.status(404).json({ ok: false, error: 'not_found' });
    return res.status(200).json({ ok: true, photographer: rows[0] });
  }
  const rows = await sql`select slug, name, location, specialisms, for_hire, instagram, website, bio
                         from photographers where status = 'approved' order by created_at desc limit 500`;
  return res.status(200).json({ ok: true, photographers: rows });
});
