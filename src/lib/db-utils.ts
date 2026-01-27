type RowRecord = Record<string, unknown> | undefined;

export const getRowString = (row: RowRecord, key: string) => {
  const value = row?.[key];
  if (value === undefined || value === null) {
    return null;
  }
  return String(value);
};

export const normalizeTokenRow = (row: RowRecord) => {
  if (!row) {
    return undefined;
  }

  return {
    token: getRowString(row, "token") ?? "",
    telegram_user_id: getRowString(row, "telegram_user_id") ?? "",
    used_at: getRowString(row, "used_at"),
  };
};
