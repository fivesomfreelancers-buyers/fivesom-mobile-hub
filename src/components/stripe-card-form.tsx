import {
  CardCvcElement,
  CardExpiryElement,
  CardNumberElement,
  Elements,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { Loader2, ShieldCheck } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

let stripePromise: Promise<Stripe | null> | null = null;
function getStripe(publishableKey: string) {
  if (!stripePromise) stripePromise = loadStripe(publishableKey);
  return stripePromise;
}

const elementStyle = {
  style: {
    base: {
      fontSize: "15px",
      color: "hsl(var(--foreground))",
      "::placeholder": { color: "hsl(var(--muted-foreground))" },
    },
    invalid: { color: "hsl(var(--destructive))" },
  },
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="rounded-xl border border-input bg-background px-3 py-3">{children}</div>
    </div>
  );
}

function CardForm({
  clientSecret,
  amountLabel,
  onPaid,
}: {
  clientSecret: string;
  amountLabel: string;
  onPaid: (paymentIntentId: string) => Promise<void> | void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    const card = elements.getElement(CardNumberElement);
    if (!card) return;
    if (!name.trim()) {
      setError("Enter the name on the card");
      return;
    }
    setBusy(true);
    setError(null);
    const result = await stripe.confirmCardPayment(clientSecret, {
      payment_method: { card, billing_details: { name: name.trim() } },
    });
    if (result.error) {
      setError(result.error.message ?? "Payment failed. Please try again.");
      setBusy(false);
      return;
    }
    if (result.paymentIntent?.status === "succeeded") {
      await onPaid(result.paymentIntent.id);
      return;
    }
    setError("Payment could not be completed. Please try another card.");
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="rounded bg-[#1434CB] px-1.5 py-0.5 text-[10px] font-bold text-white">VISA</span>
        <span className="rounded bg-[#EB621D] px-1.5 py-0.5 text-[10px] font-bold text-white">MC</span>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="cardname">Name on card</Label>
        <Input
          id="cardname"
          className="h-11 rounded-xl"
          placeholder="Name on card"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="cc-name"
        />
      </div>

      <Field label="Card number">
        <CardNumberElement options={{ ...elementStyle, showIcon: true }} />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Expiry">
          <CardExpiryElement options={elementStyle} />
        </Field>
        <Field label="CVC">
          <CardCvcElement options={elementStyle} />
        </Field>
      </div>

      {error ? <p className="text-xs font-medium text-destructive">{error}</p> : null}

      <Button type="submit" className="h-12 w-full rounded-xl text-base" disabled={!stripe || busy}>
        {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        Pay {amountLabel}
      </Button>

      <p className="text-center text-[11px] text-muted-foreground">
        Card details are handled directly by Stripe. FIVESOM never stores them.
      </p>
      <p className="flex items-center justify-center gap-2 rounded-lg bg-success/10 p-2.5 text-[11px] font-medium text-success">
        <ShieldCheck className="h-3.5 w-3.5" />
        PCI-compliant live payments handled by Stripe
      </p>
    </form>
  );
}

export function StripeCardForm(props: {
  publishableKey: string;
  clientSecret: string;
  amountLabel: string;
  onPaid: (paymentIntentId: string) => Promise<void> | void;
}) {
  return (
    <Elements stripe={getStripe(props.publishableKey)} options={{ clientSecret: props.clientSecret }}>
      <CardForm {...props} />
    </Elements>
  );
}
