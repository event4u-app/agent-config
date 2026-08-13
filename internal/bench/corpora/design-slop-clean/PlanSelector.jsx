// clean: plan choice as a radio group so keyboard and screen readers get real selection semantics
import { useId, useState } from "react";

const PLANS = [
  {
    id: "team",
    name: "Team",
    price: "29 EUR per seat, per month",
    limits: ["Up to 25 seats", "90 day event retention", "600 API requests per minute"],
  },
  {
    id: "business",
    name: "Business",
    price: "65 EUR per seat, per month",
    limits: ["Unlimited seats", "3 year event retention", "6,000 API requests per minute"],
  },
];

export function PlanSelector({ current, onChange }) {
  const groupId = useId();
  const [selected, setSelected] = useState(current ?? "team");

  function pick(id) {
    setSelected(id);
    onChange?.(id);
  }

  return (
    <fieldset className="plans">
      <legend className="plans__legend">Choose a plan</legend>

      {PLANS.map((plan) => {
        const inputId = `${groupId}-${plan.id}`;
        return (
          <div className="plans__option" key={plan.id}>
            <input
              className="plans__radio"
              type="radio"
              id={inputId}
              name="plan"
              value={plan.id}
              checked={selected === plan.id}
              onChange={() => pick(plan.id)}
              aria-describedby={`${inputId}-limits`}
            />
            <label className="plans__label" htmlFor={inputId}>
              <span className="plans__name">{plan.name}</span>
              <span className="plans__price">{plan.price}</span>
            </label>
            <ul className="plans__limits" id={`${inputId}-limits`}>
              {plan.limits.map((limit) => (
                <li key={limit}>{limit}</li>
              ))}
            </ul>
            {plan.id === current && <p className="plans__current">Your current plan</p>}
          </div>
        );
      })}

      <p className="plans__note">
        Changing plan takes effect at the next billing date, 1 April. We prorate
        the seat difference.
      </p>
    </fieldset>
  );
}
