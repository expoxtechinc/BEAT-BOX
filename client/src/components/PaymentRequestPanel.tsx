import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import { money } from "@/lib/marketplace";
import type { Beat } from "@/lib/models";
import { supabase } from "@/lib/supabase";
import { CheckCircle2, ExternalLink, Loader2, MessageCircle, Upload } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "wouter";

type PaymentInstruction = { id: string; method_type: string; method_name: string; account_number: string; instructions: string | null };
type PublicSeller = { whatsapp: string | null; producer_name: string | null; display_name: string | null };

const localDateTime = () => {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 16);
};
const whatsappUrl = (number: string, text: string) => `https://wa.me/${number.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;

export function PaymentRequestPanel({ beat }: { beat: Beat }) {
  const { user } = useSupabaseAuth();
  const [method, setMethod] = useState("Mobile Money");
  const [reference, setReference] = useState("");
  const [submittedAmount, setSubmittedAmount] = useState(String(beat.price || ""));
  const [paymentSentAt, setPaymentSentAt] = useState(localDateTime());
  const [note, setNote] = useState("");
  const [proof, setProof] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [instructions, setInstructions] = useState<PaymentInstruction[]>([]);
  const [seller, setSeller] = useState<PublicSeller | null>(null);

  useEffect(() => {
    void supabase.rpc("get_public_sellers", { p_seller_id: beat.seller_id }).maybeSingle().then(({ data }) => setSeller((data as PublicSeller | null) || null));
  }, [beat.seller_id]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) return;
    setBusy(true); setMessage(null);
    try {
      let proofPath: string | null = null;
      if (proof) {
        const safe = proof.name.replace(/[^a-zA-Z0-9._-]/g, "-");
        proofPath = `${user.id}/${crypto.randomUUID()}-${safe}`;
        const { error: uploadError } = await supabase.storage.from("payment-proofs").upload(proofPath, proof, { upsert: false, contentType: proof.type });
        if (uploadError) throw uploadError;
      }
      const { data: orderId, error } = await supabase.rpc("create_payment_request_v2", {
        p_beat_id: beat.id,
        p_method: method,
        p_reference: reference,
        p_submitted_amount: Number(submittedAmount),
        p_payment_sent_at: new Date(paymentSentAt).toISOString(),
        p_buyer_note: note || null,
        p_proof_path: proofPath,
      });
      if (error) throw error;
      const { data: methods, error: methodsError } = await supabase.from("seller_payment_methods").select("id,method_type,method_name,account_number,instructions").eq("seller_id", beat.seller_id).eq("method_type", method).eq("is_active", true);
      if (methodsError) throw methodsError;
      setInstructions((methods ?? []) as PaymentInstruction[]);
      setMessage("Payment reference submitted for seller review. No payment has been verified and no private download is released yet.");
      if (seller?.whatsapp) {
        const sellerName = seller.producer_name || seller.display_name || "BeatBox seller";
        const handoff = [
          "BeatBox payment-reference submission",
          `Listing: ${beat.title}`,
          `Quoted price: ${money(beat.price)}`,
          `Amount sent: ${submittedAmount}`,
          `Method: ${method}`,
          `Reference: ${reference}`,
          `Sent at: ${new Date(paymentSentAt).toLocaleString()}`,
          `Order: ${String(orderId)}`,
          note ? `Buyer note: ${note}` : "",
          "Please review this against your own payment records. This message is not proof of payment.",
        ].filter(Boolean).join("\n");
        window.location.assign(whatsappUrl(seller.whatsapp, `Hello ${sellerName},\n\n${handoff}`));
      }
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to submit the payment reference."); }
    finally { setBusy(false); }
  };

  if (!user) return <div className="payment-request"><h3>Request this license</h3><p>Sign in to submit a real Mobile Money, Orange Money, or WhatsApp payment reference.</p><Link className="button button--small" href="/auth">Sign in to continue</Link></div>;
  return <form className="payment-request" onSubmit={submit}><div className="payment-request__title"><div><p className="eyebrow"><span /> Payment reference</p><h3>Buy “{beat.title}”</h3></div><strong>{money(beat.price)}</strong></div><p>Pay the seller using their instructions, then submit the exact amount, reference, and time you sent it. BeatBox never marks a payment successful automatically; the seller must review it before any private download can be released.</p>{seller?.whatsapp && <p className="license-note"><MessageCircle size={15} /> This seller allows a buyer WhatsApp handoff. After you submit, BeatBox opens a prefilled chat containing your payment-reference form. <a href={whatsappUrl(seller.whatsapp, `Hello, I have a question about ${beat.title} on BeatBox.`)} target="_blank" rel="noreferrer">Contact seller <ExternalLink size={13} /></a></p>}<div className="field-grid"><label>Payment method<select value={method} onChange={event => { setMethod(event.target.value); setInstructions([]); }}><option>Mobile Money</option><option>Orange Money</option><option>WhatsApp</option></select></label><label>Amount sent<input type="number" min="0.01" step="0.01" value={submittedAmount} onChange={event => setSubmittedAmount(event.target.value)} required /></label><label>Reference number<input value={reference} onChange={event => setReference(event.target.value)} placeholder="Transaction reference" required maxLength={140} /></label><label>Payment sent at<input type="datetime-local" value={paymentSentAt} onChange={event => setPaymentSentAt(event.target.value)} required /></label><label className="field-grid__wide">Buyer note (optional)<textarea value={note} onChange={event => setNote(event.target.value)} rows={2} maxLength={1000} placeholder="Any detail the seller should review" /></label></div><label className="upload-proof"><Upload size={16} /><span>{proof ? proof.name : "Attach payment proof (optional)"}</span><input type="file" accept="image/jpeg,image/png,application/pdf" onChange={event => setProof(event.target.files?.[0] ?? null)} /></label><button className="button" type="submit" disabled={busy}>{busy ? <Loader2 className="spin" size={16} /> : null} Submit reference and open WhatsApp</button>{message && <p className={message.startsWith("Payment reference submitted") ? "form-success" : "form-error"}>{message.startsWith("Payment reference submitted") && <CheckCircle2 size={16} />}{message}</p>}{message?.startsWith("Payment reference submitted") && <div className="payment-instructions"><b>Seller review instructions</b>{instructions.length ? instructions.map(item => <div key={item.id}><span>{item.method_type} · {item.method_name}</span><strong>{item.account_number}</strong>{item.instructions && <small>{item.instructions}</small>}</div>) : <p>Your submitted reference is pending seller review. Keep your own payment receipt until the seller confirms the request.</p>}</div>}</form>;
}
