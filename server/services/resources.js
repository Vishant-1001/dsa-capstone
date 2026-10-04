const { contacts } = require('../models/system');
const { runtime, now } = require('./runtime');
const { oneOf, text } = require('../utils/validate');
const { badRequest, notFound } = require('../utils/errors');

const PHONE = /^[0-9+()\-\s]{3,24}$/;

function phone(value, name) {
  const v = text(value, name, { required: false, max: 24 });
  if (v && !PHONE.test(v)) throw badRequest(`${name} may only contain digits, spaces, plus, dash and brackets`);
  return v || null;
}

function website(value) {
  const v = text(value, 'Website', { required: false, max: 200 });
  if (!v) return null;
  let url;
  try {
    url = new URL(v);
  } catch (err) {
    throw badRequest('Website must be a full address such as https://example.org');
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw badRequest('Website must start with http or https');
  return url.toString();
}

function parse(input, existing) {
  const kind = input.kind === undefined && existing ? existing.kind : oneOf(input.kind, ['HELPLINE', 'HOSPITAL'], 'Kind');
  const pick = (key, fallback) => (input[key] === undefined && existing ? existing[fallback || key] : input[key]);
  const hospitalId = kind === 'HOSPITAL' ? pick('hospitalId') || null : null;
  if (hospitalId && !runtime.hospitals.has(hospitalId)) throw badRequest(`Hospital ${hospitalId} does not exist`);
  return {
    kind,
    name: text(pick('name'), 'Name', { max: 120 }),
    phone: phone(pick('phone'), 'Phone'),
    altPhone: phone(pick('altPhone'), 'Alternate phone'),
    hospitalId,
    address: text(pick('address'), 'Address', { required: false, max: 200 }) || null,
    website: website(pick('website')),
    notes: text(pick('notes'), 'Notes', { required: false, max: 300 }) || null,
    source: text(pick('source'), 'Source', { required: false, max: 120 }) || null,
  };
}

function decorate(c) {
  const h = c.hospitalId ? runtime.hospitals.get(c.hospitalId) : null;
  return { ...c, hospital: h ? { id: h.id, status: h.status, availableBeds: h.availableBeds, totalBeds: h.totalBeds } : null };
}

function list({ kind, q } = {}) {
  const needle = q ? String(q).toLowerCase().slice(0, 60) : '';
  return contacts
    .all('kind, name')
    .filter((c) => (!kind || c.kind === kind) && (!needle || `${c.name} ${c.phone || ''} ${c.altPhone || ''} ${c.address || ''}`.toLowerCase().includes(needle)))
    .map(decorate);
}

function create(input) {
  const row = { ...parse(input), updatedAt: now() };
  const id = contacts.insert(row);
  return decorate(contacts.get(id));
}

function update(id, input) {
  const existing = contacts.get(Number(id));
  if (!existing) throw notFound(`Contact ${id} not found`);
  contacts.update(existing.id, { ...parse(input, existing), updatedAt: now() });
  return decorate(contacts.get(existing.id));
}

function remove(id) {
  if (!contacts.remove(Number(id))) throw notFound(`Contact ${id} not found`);
}

module.exports = { list, create, update, remove };
