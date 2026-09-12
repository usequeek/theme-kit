'use client';

import type { JSX } from 'react';
import type { TableBlockData } from '../types/block';

/**
 * Framework-owned table block. Semantic HTML table with theme-scoped styling.
 * Themes style via `.core-block-table` + sub-elements.
 */
export function CoreTableBlock({ headers, rows }: TableBlockData): JSX.Element | null {
  const safeHeaders = Array.isArray(headers) ? headers : [];
  const safeRows = Array.isArray(rows) ? rows : [];

  if (safeHeaders.length === 0 && safeRows.length === 0) return null;

  return (
    <section className="core-block core-block-table">
      <div className="core-block-table__wrap">
        <table className="core-block-table__table">
          {safeHeaders.length > 0 ? (
            <thead className="core-block-table__head">
              <tr>
                {safeHeaders.map((header, i) => (
                  <th key={i} className="core-block-table__th">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
          ) : null}
          <tbody className="core-block-table__body">
            {safeRows.map((row, rowIndex) => (
              <tr key={rowIndex} className="core-block-table__row">
                {(Array.isArray(row) ? row : []).map((cell, cellIndex) => (
                  <td key={cellIndex} className="core-block-table__cell">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
