import type { CurrentUser } from "../model/user";

type AccountOverviewProps = {
  user: CurrentUser;
};

export function AccountOverview({ user }: AccountOverviewProps) {
  return (
    <section aria-labelledby="account-title" className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 id="account-title" className="text-2xl font-bold text-slate-900">
          Account
        </h1>
        <p className="text-slate-700">
          The details of your Montelingo account.
        </p>
      </div>
      <dl className="flex flex-col gap-1">
        <dt className="text-sm font-medium text-slate-700">Email</dt>
        <dd className="break-all font-medium text-slate-900">{user.email}</dd>
      </dl>
    </section>
  );
}
