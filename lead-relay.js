/* Delivers the notification email for a saved lead.
   Web3Forms rejects server-side submissions on the free plan, so the browser
   makes this call. The lead itself is already stored server-side — this is
   best-effort delivery, and failure is reported back for the admin console. */
(function () {
  window.saDeliverLead = async function (result) {
    if (!result || !result.notify || !result.notify.payload) return false;

    let delivered = false;
    let reason = '';
    try {
      const res = await fetch(result.notify.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(result.notify.payload),
      });
      const data = await res.json().catch(function () { return {}; });
      delivered = res.ok && data.success !== false;
      if (!delivered) reason = data.message || ('http ' + res.status);
    } catch (e) {
      reason = String(e && e.message ? e.message : e);
    }

    if (!delivered) console.warn('Lead email not delivered:', reason);

    if (result.leadId) {
      try {
        await fetch('/api/lead', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ confirmLeadId: result.leadId, delivered: delivered, reason: reason }),
        });
      } catch (e) { /* the lead is stored regardless */ }
    }
    return delivered;
  };
})();
