// SalesEntryForm.jsx
import React, { useState } from 'react';
import { supabase } from './supabaseClient';

// Helper to safely generate IDs on the client
const makeId = () =>
  (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

export default function SalesEntryForm({
  organizationId,
  currentUserId,              // optional, but recommended
  statusOptions,
  ratingOptions,
  industryOptions,
  buyingRoleOptions,
  callTypeOptions,
}) {
  const [form, setForm] = useState({
    company: '',
    contact_name: '',
    contact_title: '',
    buying_role: '',
    contact_email: '',
    contact_phone: '',
    extension: '',
    website: '',
    note: '',
    call_type: '',
    call_status: '',
    industry: '',
    rating: '',
  });

  const [selectedLead, setSelectedLead] = useState(null);          // from "Previous Call"
  const [selectedBusiness, setSelectedBusiness] = useState(null);  // for geo + address
  const [locStatus, setLocStatus] = useState('idle');

  const [submitting, setSubmitting] = useState(false);

  // Previous Call modal
  const [prevModalOpen, setPrevModalOpen] = useState(false);
  const [prevLeads, setPrevLeads] = useState([]);
  const [prevLoading, setPrevLoading] = useState(false);
  const [prevSearch, setPrevSearch] = useState('');

  // Business search modal
  const [bizModalOpen, setBizModalOpen] = useState(false);
  const [bizResults, setBizResults] = useState([]);
  const [bizLoading, setBizLoading] = useState(false);
  const [bizQuery, setBizQuery] = useState('');

  // Card upload
  const [cardUploading, setCardUploading] = useState(false);
  const [cardUrl, setCardUrl] = useState(null);

  const updateField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  // ---------- GEOLOCATION ----------
  const captureLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported in this browser.');
      return;
    }

    setLocStatus('locating');

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setSelectedBusiness((prev) => ({
          ...(prev || {}),
          latitude,
          longitude,
          captured_at: new Date().toISOString(),
        }));
        setLocStatus('success');
      },
      () => setLocStatus('error'),
      { enableHighAccuracy: true }
    );
  };

  // ---------- PREVIOUS CALLS ----------
  const openPreviousCalls = async () => {
    setPrevModalOpen(true);
    setPrevLoading(true);

    const query = supabase
      .from('leads')
      .select('id, company, contact_name, contact_phone, status, rating, industry, created_at, location_raw')
      .eq('org_id', organizationId)
      .order('created_at', { ascending: false })
      .limit(50);

    const { data, error } = await query;
    setPrevLoading(false);

    if (error) {
      console.error(error);
      alert('Error loading previous calls.');
      return;
    }

    setPrevLeads(data || []);
  };

  const filteredPrevLeads = prevLeads.filter((lead) => {
    if (!prevSearch.trim()) return true;
    const q = prevSearch.toLowerCase();
    return (
      (lead.company || '').toLowerCase().includes(q) ||
      (lead.contact_name || '').toLowerCase().includes(q) ||
      (lead.contact_phone || '').toLowerCase().includes(q)
    );
  });

  const selectPreviousLead = (lead) => {
    setSelectedLead(lead);
    setPrevModalOpen(false);

    setForm((prev) => ({
      ...prev,
      company: lead.company || '',
      contact_name: lead.contact_name || '',
      contact_phone: lead.contact_phone || '',
      industry: lead.industry || '',
      status: lead.status || '',
      rating: lead.rating || '',
    }));

    // try to restore location from location_raw if present
    if (lead.location_raw) {
      try {
        const parsed = JSON.parse(lead.location_raw);
        setSelectedBusiness((prev) => ({
          ...(prev || {}),
          ...parsed,
        }));
      } catch {
        // ignore parse error
      }
    }
  };

  // ---------- BUSINESS SEARCH (TEMP: SEARCH EXISTING LEADS) ----------
  const openBusinessSearch = () => {
    setBizModalOpen(true);
    setBizResults([]);
    setBizQuery('');
  };

  const runBusinessSearch = async () => {
    if (!bizQuery.trim()) return;

    setBizLoading(true);
    const { data, error } = await supabase
      .from('leads')
      .select('id, company, website, industry, location_raw, latitude, longitude, contact_name, contact_phone')
      .eq('org_id', organizationId)
      .ilike('company', `%${bizQuery}%`)
      .limit(25);

    setBizLoading(false);

    if (error) {
      console.error(error);
      alert('Error searching businesses.');
      return;
    }

    setBizResults(data || []);
  };

  const chooseBusiness = (b) => {
    setBizModalOpen(false);
    setSelectedBusiness(() => {
      if (b.location_raw) {
        try {
          return JSON.parse(b.location_raw);
        } catch {
          // fall through
        }
      }
      return {
        latitude: b.latitude,
        longitude: b.longitude,
        company: b.company,
        website: b.website,
      };
    });

    setForm((prev) => ({
      ...prev,
      company: b.company || prev.company,
      website: b.website || prev.website,
      industry: b.industry || prev.industry,
      contact_name: b.contact_name || prev.contact_name,
      contact_phone: b.contact_phone || prev.contact_phone,
    }));
  };

  // ---------- CARD SCAN / UPLOAD ----------
  const onCardFileChange = async (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    if (!organizationId) {
      alert('No organization selected.');
      return;
    }

    setCardUploading(true);
    const ext = file.name.split('.').pop() || 'jpg';
    const path = `${organizationId}/${makeId()}.${ext}`;

    const { error } = await supabase.storage.from('lead_cards').upload(path, file);

    setCardUploading(false);

    if (error) {
      console.error(error);
      alert('Error uploading card image.');
      return;
    }

    const { data: publicUrlData } = supabase.storage.from('lead_cards').getPublicUrl(path);
    setCardUrl(publicUrlData?.publicUrl || null);
  };

  const triggerCardUpload = () => {
    const input = document.getElementById('card-upload-input');
    if (input) input.click();
  };

  // ---------- SUBMIT ----------
  const handleSubmit = async () => {
    if (!form.company.trim()) {
      alert('Company is required.');
      return;
    }
    if (!form.industry) {
      alert('Industry is required.');
      return;
    }
    if (!form.note.trim()) {
      alert('A call note is required.');
      return;
    }

    setSubmitting(true);

    const now = new Date().toISOString();
    const callEntry = {
      id: makeId(),
      ts: now,
      call_type: form.call_type || null,
      call_status: form.call_status || null,
      note: form.note,
      created_by_user_id: currentUserId || null,
      source: 'sales_entry_form_v1',
    };

    const noteEntry = {
      id: makeId(),
      ts: now,
      note: form.note,
      created_by_user_id: currentUserId || null,
      source: 'sales_entry_form_v1',
    };

    const locationRaw = selectedBusiness ? JSON.stringify(selectedBusiness) : null;

    const payload = {
      org_id: organizationId,
      company: form.company,
      contact_name: form.contact_name,
      contact_title: form.contact_title,
      contact_email: form.contact_email,
      contact_phone: form.contact_phone,
      website: form.website,
      buying_role: form.buying_role || null,
      status: form.call_status || null,
      rating: form.rating || null,
      industry: form.industry,
      latitude: selectedBusiness?.latitude || null,
      longitude: selectedBusiness?.longitude || null,
      location_raw: locationRaw,
      primary_image_url: cardUrl || null,

      source: 'sales_entry_form',
      created_by_user_id: currentUserId || null,
      owner_user_id: currentUserId || null,

      call_history: [callEntry],
      note_history: [noteEntry],
      // placeholders for future flows:
      email_history: [],
      quote_history: [],
      extra_files: cardUrl
        ? [{ id: makeId(), type: 'business_card', url: cardUrl, ts: now }]
        : [],
      business_info: {
        selected_lead_id: selectedLead?.id || null,
        call_type: form.call_type || null,
        loc_status: locStatus,
      },
    };

    const { error } = await supabase.from('leads').insert(payload);
    setSubmitting(false);

    if (error) {
      console.error(error);
      alert('Error saving lead: ' + error.message);
      return;
    }

    alert('Lead saved!');

    // Reset core fields, keep some context like industry if you prefer
    setForm({
      company: '',
      contact_name: '',
      contact_title: '',
      buying_role: '',
      contact_email: '',
      contact_phone: '',
      extension: '',
      website: '',
      note: '',
      call_type: '',
      call_status: '',
      industry: '',
      rating: '',
    });
    setSelectedLead(null);
    setSelectedBusiness(null);
    setCardUrl(null);
  };

  // ---------- RENDER ----------
  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <header className="space-y-2">
        <h2 className="text-2xl font-bold text-center">Sales Activity Entry</h2>
        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          <button
            type="button"
            onClick={openPreviousCalls}
            className="px-4 py-2 rounded-full bg-blue-700 text-white text-sm font-medium"
          >
            Select Previous Call
          </button>
          <button
            type="button"
            onClick={openBusinessSearch}
            className="px-4 py-2 rounded-full bg-blue-700 text-white text-sm font-medium"
          >
            Search Business Info
          </button>
          <button
            type="button"
            onClick={triggerCardUpload}
            className="px-4 py-2 rounded-full bg-blue-900 text-white text-sm font-medium"
          >
            {cardUploading ? 'Uploading Card…' : 'Scan Card (Optional)'}
          </button>
        </div>
        <input
          id="card-upload-input"
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onCardFileChange}
        />
        {cardUrl && (
          <p className="text-xs text-center text-green-700">
            Card image attached.
          </p>
        )}
      </header>

      {/* Core fields */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold mb-1">Company (Required)</label>
          <input
            className="w-full p-2 border rounded"
            value={form.company}
            onChange={(e) => updateField('company', e.target.value)}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold mb-1">Contact Name</label>
          <input
            className="w-full p-2 border rounded"
            value={form.contact_name}
            onChange={(e) => updateField('contact_name', e.target.value)}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold mb-1">Contact Title</label>
          <input
            className="w-full p-2 border rounded"
            placeholder="e.g., Operations Manager"
            value={form.contact_title}
            onChange={(e) => updateField('contact_title', e.target.value)}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold mb-1">Buying Role</label>
          <select
            className="w-full p-2 border rounded"
            value={form.buying_role}
            onChange={(e) => updateField('buying_role', e.target.value)}
          >
            <option value="">Select Buying Role</option>
            {buyingRoleOptions.map((o) => (
              <option key={o.id} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold mb-1">Email Address</label>
          <input
            className="w-full p-2 border rounded"
            type="email"
            value={form.contact_email}
            onChange={(e) => updateField('contact_email', e.target.value)}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold mb-1">Phone Number</label>
          <input
            className="w-full p-2 border rounded"
            placeholder="(000) 000-0000"
            value={form.contact_phone}
            onChange={(e) => updateField('contact_phone', e.target.value)}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold mb-1">Website</label>
          <input
            className="w-full p-2 border rounded"
            placeholder="https://example.com"
            value={form.website}
            onChange={(e) => updateField('website', e.target.value)}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold mb-1">Industry (Required)</label>
          <select
            className="w-full p-2 border rounded"
            value={form.industry}
            onChange={(e) => updateField('industry', e.target.value)}
          >
            <option value="">Select Industry</option>
            {industryOptions.map((o) => (
              <option key={o.id} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold mb-1">Rating</label>
          <select
            className="w-full p-2 border rounded"
            value={form.rating}
            onChange={(e) => updateField('rating', e.target.value)}
          >
            <option value="">Select Rating</option>
            {ratingOptions.map((o) => (
              <option key={o.id} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Call meta + note */}
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-semibold mb-1">Call Type</label>
          <select
            className="w-full p-2 border rounded bg-yellow-50"
            value={form.call_type}
            onChange={(e) => updateField('call_type', e.target.value)}
          >
            <option value="">Select Call Type</option>
            {callTypeOptions.map((o) => (
              <option key={o.id} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold mb-1">Call Status</label>
          <select
            className="w-full p-2 border rounded"
            value={form.call_status}
            onChange={(e) => updateField('call_status', e.target.value)}
          >
            <option value="">Select Call Status</option>
            {statusOptions.map((o) => (
              <option key={o.id} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold mb-1">Call Note (Required)</label>
          <textarea
            className="w-full p-2 border rounded min-h-[100px]"
            value={form.note}
            onChange={(e) => updateField('note', e.target.value)}
          />
        </div>
      </div>

      {/* Location + Submit */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={captureLocation}
            className="px-4 py-2 rounded-full bg-blue-700 text-white text-sm font-medium"
          >
            {locStatus === 'locating' ? 'Capturing Location…' : 'Capture Location'}
          </button>
          {locStatus === 'success' && (
            <span className="text-xs text-green-700">
              Location captured.
            </span>
          )}
          {locStatus === 'error' && (
            <span className="text-xs text-red-700">
              Location failed.
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full py-3 rounded-full bg-green-600 text-white font-semibold"
        >
          {submitting ? 'Submitting…' : 'Submit'}
        </button>
      </div>

      {/* ---------- PREVIOUS CALL MODAL ---------- */}
      {prevModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-40">
          <div className="bg-white rounded-xl p-4 w-full max-w-lg max-h-[80vh] flex flex-col gap-3">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold text-lg">Select Previous Call</h3>
              <button onClick={() => setPrevModalOpen(false)}>✕</button>
            </div>

            <input
              className="w-full p-2 border rounded text-sm"
              placeholder="Search by company, contact, or phone"
              value={prevSearch}
              onChange={(e) => setPrevSearch(e.target.value)}
            />

            <div className="flex-1 overflow-y-auto border rounded p-2 space-y-1 text-sm">
              {prevLoading && <div>Loading…</div>}
              {!prevLoading && filteredPrevLeads.length === 0 && (
                <div className="text-xs text-gray-500">No previous calls found.</div>
              )}
              {filteredPrevLeads.map((lead) => (
                <button
                  key={lead.id}
                  type="button"
                  onClick={() => selectPreviousLead(lead)}
                  className="w-full text-left px-2 py-1 rounded hover:bg-gray-100"
                >
                  <div className="font-semibold">{lead.company}</div>
                  <div className="text-xs text-gray-600">
                    {lead.contact_name} • {lead.contact_phone}
                  </div>
                  <div className="text-[11px] text-gray-500">
                    {lead.status} • {lead.rating} • {lead.industry}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ---------- BUSINESS SEARCH MODAL ---------- */}
      {bizModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-40">
          <div className="bg-white rounded-xl p-4 w-full max-w-lg max-h-[80vh] flex flex-col gap-3">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold text-lg">Search Business Info</h3>
              <button onClick={() => setBizModalOpen(false)}>✕</button>
            </div>

            <div className="flex gap-2">
              <input
                className="flex-1 p-2 border rounded text-sm"
                placeholder="Search by company name"
                value={bizQuery}
                onChange={(e) => setBizQuery(e.target.value)}
              />
              <button
                type="button"
                onClick={runBusinessSearch}
                className="px-3 py-2 rounded bg-blue-700 text-white text-sm"
              >
                Search
              </button>
            </div>

            <div className="flex-1 overflow-y-auto border rounded p-2 space-y-1 text-sm">
              {bizLoading && <div>Searching…</div>}
              {!bizLoading && bizResults.length === 0 && (
                <div className="text-xs text-gray-500">
                  No matching businesses yet. (Google Places can be wired here later.)
                </div>
              )}
              {bizResults.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => chooseBusiness(b)}
                  className="w-full text-left px-2 py-1 rounded hover:bg-gray-100"
                >
                  <div className="font-semibold">{b.company}</div>
                  <div className="text-xs text-gray-600">{b.website}</div>
                  <div className="text-[11px] text-gray-500">
                    {b.industry} • {b.contact_name} • {b.contact_phone}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
