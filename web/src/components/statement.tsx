'use client';

import { useState } from 'react';
import { formatKobo } from '@/lib/money';
import { describeLine, type StatementLine } from '@/lib/statement';
import type { Page } from '@/lib/types';
import { ErrorAlert, Pager, shortDate, shortReference } from './ui';
import { useApiQuery } from './use-api-query';

const PAGE_SIZE = 10;

/** `version` changes whenever money moves, so the statement reloads. */
export function Statement({ version }: { version: number }) {
  const [page, setPage] = useState(1);
  const {
    data: current,
    error,
    loading,
  } = useApiQuery<Page<StatementLine>>(
    `/transactions?page=${page}&limit=${PAGE_SIZE}`,
    version,
  );
  const total = current?.meta.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <section className="card statement" aria-labelledby="statement-title" aria-busy={loading}>
      <div className="statement-head">
        <h2 id="statement-title">Statement</h2>
        {current && (
          <span className="muted">
            {total} {total === 1 ? 'transaction' : 'transactions'}
          </span>
        )}
      </div>

      {error && <ErrorAlert error={error} />}

      {current && current.data.length === 0 && (
        <div className="empty">
          <strong>No transactions yet</strong>
          <span className="muted">Add money to get started; everything you do shows up here.</span>
        </div>
      )}

      {current && current.data.length > 0 && (
        <>
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Transaction</th>
                  <th scope="col" className="hide-sm">Reference</th>
                  <th scope="col" className="hide-sm">Date</th>
                  <th scope="col" className="num">Amount</th>
                  <th scope="col" className="num">Balance</th>
                </tr>
              </thead>
              <tbody>
                {current.data.map((line) => (
                  <Row key={`${line.reference}:${line.direction}`} line={line} />
                ))}
              </tbody>
            </table>
          </div>
          <Pager page={page} pages={pages} busy={loading} onChange={setPage} />
        </>
      )}

      {!current && !error && (
        <p className="muted" role="status">
          Loading your statement…
        </p>
      )}
    </section>
  );
}

function Row({ line }: { line: StatementLine }) {
  const credit = line.direction === 'CREDIT';
  const date = shortDate.format(new Date(line.createdAt));
  const { title, detail } = describeLine(line);
  return (
    <tr>
      <td>
        <div className="desc">
          <span className={`dir ${credit ? 'dir-in' : 'dir-out'}`} aria-hidden="true">
            {credit ? '↓' : '↑'}
          </span>
          <div>
            <div className="desc-title">{title}</div>
            {detail && <div className="muted desc-note">{detail}</div>}
            <div className="muted desc-note show-sm">{date}</div>
          </div>
        </div>
      </td>
      <td className="mono hide-sm" title={line.reference}>
        {shortReference(line.reference)}
      </td>
      <td className="muted hide-sm">{date}</td>
      <td className={`num ${credit ? 'amount-in' : 'amount-out'}`}>
        <span className="visually-hidden">{credit ? 'Credit' : 'Debit'} </span>
        {formatKobo(credit ? line.amount : -line.amount, { signed: true })}
      </td>
      <td className="num">{formatKobo(line.balanceAfter)}</td>
    </tr>
  );
}
