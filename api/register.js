// POST /api/register — a photographer asks to be listed. Saved as "pending" until approved.
const { endpoint, invalid, text, isUrl, slugify, EMAIL, HANDLE } = require('./_db');
const SPECS = ['Wildlife', 'Birds', 'Landscape', 'Macro', 'Underwater', 'Aerial'];

module.exports = endpoint('POST', async (sql, d, res) => {
  const name = text(d.name, 80), email = text(d.email, 160).toLowerCase(), location = text(d.location, 100);
  const instagram = text(d.instagram, 31).replace(/^@/, ''), website = text(d.website, 200), bio = text(d.bio, 280);
  const specs = Array.isArray(d.specialisms) ? d.specialisms.filter((s) => SPECS.includes(s)) : [];
  const errors = {};
  if (name.length < 2) errors.name = 'Enter your name.';
  if (!EMAIL.test(email)) errors.email = 'Enter an email address, like name@example.com.';
  if (location.length < 2) errors.location = 'Enter your town and country.';
  if (specs.length < 1 || specs.length > 3) errors.specialisms = 'Choose between one and three.';
  if (instagram && !HANDLE.test(instagram)) errors.instagram = 'Enter an Instagram username, like @yourhandle.';
  if (website && !isUrl(website)) errors.website = 'Enter a web address, like https://example.com.';
  if (d.own !== true) errors.own = 'Tick this box to confirm the work is your own.';
  if (d.terms !== true) errors.terms = 'Tick this box to agree to the terms and privacy policy.';
  if (Object.keys(errors).length) return invalid(res, errors);
  // One listing per email address. A repeat sign-up changes nothing and gets the same answer.
  await sql`insert into photographers (slug, name, email, location, specialisms, for_hire, instagram, website, bio)
            values (${slugify(name)}, ${name}, ${email}, ${location}, ${specs.join(',')}, ${d.hire === true}, ${instagram}, ${website}, ${bio})
            on conflict (email) do nothing`;
  return res.status(200).json({ ok: true });
});
