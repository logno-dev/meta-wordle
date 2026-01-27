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

export const normalizeUserRow = (row: RowRecord) => {
  if (!row) {
    return undefined;
  }

  return {
    id: getRowString(row, "id"),
    username: getRowString(row, "username") ?? "",
    password_hash: getRowString(row, "password_hash") ?? "",
    telegram_user_id: getRowString(row, "telegram_user_id") ?? "",
    created_at: getRowString(row, "created_at"),
    is_admin: Number(getRowString(row, "is_admin") ?? 0),
    total_score: Number(getRowString(row, "total_score") ?? 0),
  };
};

export const normalizeLetterRow = (row: RowRecord) => {
  if (!row) {
    return undefined;
  }

  return {
    letter: getRowString(row, "letter") ?? "",
    quantity: Number(getRowString(row, "quantity") ?? 0),
    updated_at: getRowString(row, "updated_at"),
  };
};
