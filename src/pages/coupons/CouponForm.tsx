import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Button, ErrorText, FieldLabel, Input, Modal } from '../../components/ui';
import { ApiError, apiRequest } from '../../lib/api';
import { istDateString } from '../../lib/format';

export type Coupon = {
  id: string;
  code: string;
  discountType: 'percent' | 'fixed';
  value: number;
  minimumAmount: number;
  maximumDiscount: number | null;
  maxUses: number | null;
  uses: number;
  validFrom: string | null;
  validUntil: string | null;
  isActive: boolean;
};

type Draft = {
  code: string;
  discountType: 'percent' | 'fixed';
  value: string;
  minimumAmount: string;
  maximumDiscount: string;
  maxUses: string;
  validFrom: string;
  validUntil: string;
  isActive: boolean;
};

function toDraft(c: Coupon | null): Draft {
  return {
    code: c?.code ?? '',
    discountType: c?.discountType ?? 'percent',
    value: c ? String(c.value) : '',
    minimumAmount: c && c.minimumAmount ? String(c.minimumAmount) : '',
    maximumDiscount: c?.maximumDiscount != null ? String(c.maximumDiscount) : '',
    maxUses: c?.maxUses != null ? String(c.maxUses) : '',
    validFrom: c?.validFrom ? istDateString(new Date(c.validFrom)) : '',
    validUntil: c?.validUntil ? istDateString(new Date(c.validUntil)) : '',
    isActive: c?.isActive ?? true,
  };
}

const num = (v: string) => (v.trim() === '' ? null : Number(v));

export function CouponForm({ coupon, onClose }: { coupon: Coupon | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [d, setD] = useState<Draft>(() => toDraft(coupon));
  const [error, setError] = useState('');
  const patch = (next: Partial<Draft>) => setD((x) => ({ ...x, ...next }));

  function validate(): string | null {
    if (!/^[A-Za-z0-9_-]{3,20}$/.test(d.code.trim())) return 'Code must be 3–20 letters, numbers, - or _';
    const value = num(d.value);
    if (value === null || !(value > 0)) return 'Enter a discount value above 0';
    if (d.discountType === 'percent' && value > 100) return 'A percent discount cannot exceed 100';
    if (d.discountType === 'fixed' && !Number.isInteger(value)) return 'Fixed discounts must be whole rupees';
    for (const [label, v, int, min] of [
      ['Minimum order', d.minimumAmount, false, 0],
      ['Maximum discount', d.maximumDiscount, false, 1],
      ['Usage limit', d.maxUses, true, 1],
    ] as const) {
      const n = num(v);
      if (n !== null && (Number.isNaN(n) || n < min || (int && !Number.isInteger(n)))) return `${label} is not valid`;
    }
    if (d.validFrom && d.validUntil && d.validUntil < d.validFrom) return 'The end date is before the start date';
    return null;
  }

  const save = useMutation({
    mutationFn: () => {
      const body = {
        code: d.code.trim().toUpperCase(),
        discountType: d.discountType,
        value: Number(d.value),
        minimumAmount: num(d.minimumAmount) ?? 0,
        maximumDiscount: d.discountType === 'percent' ? num(d.maximumDiscount) : null,
        maxUses: num(d.maxUses),
        validFrom: d.validFrom ? `${d.validFrom}T00:00:00+05:30` : null,
        validUntil: d.validUntil ? `${d.validUntil}T23:59:59+05:30` : null,
        isActive: d.isActive,
      };
      return coupon
        ? apiRequest<Coupon>(`/admin/coupons/${coupon.id}`, { method: 'PATCH', body: JSON.stringify(body) })
        : apiRequest<Coupon>('/admin/coupons', { method: 'POST', body: JSON.stringify(body) });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['coupons'] });
      onClose();
    },
    onError: (err: Error) => {
      if (err instanceof ApiError && (err.status === 409 || err.code === 'COUPON_EXISTS')) {
        setError(`A coupon with the code ${d.code.trim().toUpperCase()} already exists. Choose a different code.`);
      } else {
        setError(err.message);
      }
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const problem = validate();
    setError(problem ?? '');
    if (!problem) save.mutate();
  }

  return (
    <Modal open title={coupon ? `Edit ${coupon.code}` : 'New coupon'} onClose={onClose}>
      <form className="space-y-4" onSubmit={onSubmit}>
        <div>
          <FieldLabel htmlFor="coupon-code">Code</FieldLabel>
          <Input
            id="coupon-code"
            value={d.code}
            onChange={(e) => patch({ code: e.target.value.toUpperCase() })}
            placeholder="WELCOME100"
            className="font-mono uppercase"
            maxLength={20}
            required
          />
          {coupon && coupon.uses > 0 ? (
            <p className="mt-1 text-xs text-[var(--muted)]">Already used {coupon.uses} times; renaming affects new checkouts only.</p>
          ) : null}
        </div>
        <fieldset>
          <legend className="block text-xs font-semibold text-[var(--muted)] mb-1">Discount</legend>
          <div className="flex gap-2">
            <div className="flex shrink-0 rounded-lg border border-[var(--line)] p-0.5" role="radiogroup" aria-label="Discount type">
              {(['percent', 'fixed'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  role="radio"
                  aria-checked={d.discountType === t}
                  onClick={() => patch({ discountType: t })}
                  className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm ${
                    d.discountType === t ? 'bg-[var(--brand)] text-white' : 'text-[var(--ink)]'
                  }`}
                >
                  {t === 'percent' ? '% off' : '₹ off'}
                </button>
              ))}
            </div>
            <Input
              aria-label="Discount value"
              type="number"
              min={0}
              step={d.discountType === 'fixed' ? 1 : 'any'}
              value={d.value}
              onChange={(e) => patch({ value: e.target.value })}
              placeholder={d.discountType === 'percent' ? '10' : '100'}
              required
            />
          </div>
        </fieldset>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <FieldLabel htmlFor="coupon-min" hint="(₹, optional)">
              Minimum order
            </FieldLabel>
            <Input id="coupon-min" type="number" min={0} value={d.minimumAmount} onChange={(e) => patch({ minimumAmount: e.target.value })} />
          </div>
          {d.discountType === 'percent' ? (
            <div>
              <FieldLabel htmlFor="coupon-cap" hint="(₹, optional)">
                Maximum discount
              </FieldLabel>
              <Input id="coupon-cap" type="number" min={0} value={d.maximumDiscount} onChange={(e) => patch({ maximumDiscount: e.target.value })} />
            </div>
          ) : null}
          <div>
            <FieldLabel htmlFor="coupon-uses" hint="(blank = unlimited)">
              Usage limit
            </FieldLabel>
            <Input id="coupon-uses" type="number" min={1} step={1} value={d.maxUses} onChange={(e) => patch({ maxUses: e.target.value })} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <FieldLabel htmlFor="coupon-from" hint="(optional)">
              Valid from
            </FieldLabel>
            <Input id="coupon-from" type="date" value={d.validFrom} onChange={(e) => patch({ validFrom: e.target.value })} />
          </div>
          <div>
            <FieldLabel htmlFor="coupon-until" hint="(optional, inclusive)">
              Valid until
            </FieldLabel>
            <Input
              id="coupon-until"
              type="date"
              min={d.validFrom || undefined}
              value={d.validUntil}
              onChange={(e) => patch({ validUntil: e.target.value })}
            />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            aria-label="Active"
            checked={d.isActive}
            onChange={(e) => patch({ isActive: e.target.checked })}
            className="size-4 accent-[var(--brand)]"
          />
          Active — patients can apply this code at checkout
        </label>
        <ErrorText>{error}</ErrorText>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? 'Saving…' : coupon ? 'Save changes' : 'Create coupon'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
