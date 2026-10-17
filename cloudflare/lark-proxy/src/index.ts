interface Env {
  APP_ID: string;
  'APP-SECRET': string;
  LARK_APP_TOKEN: string;
  LARK_TABLE_ID: string;
  PROXY_ACCESS_KEY: string;
  ALLOWED_ORIGIN: string;
}

const FIELD_IDS = {
  workshop: 'fld3Z7MnaB',
  name: 'fldtDlmW1w',
  phone: 'fldlRDbj9a',
  studentId: 'fldv64kybI',
} as const;

const FIELD_NAMES = {
  workshop: 'Mã Workshop',
  name: 'Họ và tên của bạn là',
  phone: 'Số điện thoại liên hệ',
  studentId: 'Mã số học sinh/sinh viên',
} as const;

const json = (body: unknown, status = 200, origin = '') => new Response(JSON.stringify(body), {
  status,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Vary': 'Origin',
  },
});

const cellText = (value: unknown): string => {
  if (typeof value === 'string' || typeof value === 'number') return String(value).trim();
  if (Array.isArray(value)) return value.map(cellText).filter(Boolean).join(', ');
  if (value && typeof value === 'object' && 'text' in value) return cellText((value as { text: unknown }).text);
  return '';
};

const fieldText = (fields: Record<string, unknown>, field: keyof typeof FIELD_IDS): string =>
  cellText(fields[FIELD_IDS[field]] ?? fields[FIELD_NAMES[field]]);

async function larkJson(response: Response, source: string) {
  const contentType = response.headers.get('content-type') || 'không rõ Content-Type';
  const body = await response.text();
  try {
    return JSON.parse(body) as Record<string, any>;
  } catch {
    const preview = body.slice(0, 120).replace(/[\r\n\t]+/g, ' ').trim();
    throw new Error(`${source} trả phản hồi không phải JSON (HTTP ${response.status}; ${contentType}; ${preview || 'body rỗng'}).`);
  }
}

async function readAllRecords(env: Env, token: string) {
  const records: Array<{ fields: Record<string, unknown> }> = [];
  const appToken = env.LARK_APP_TOKEN.trim();
  const tableId = env.LARK_TABLE_ID.trim();
  let pageToken = '';
  for (let page = 0; page < 20; page++) {
    const url = new URL(`https://open.larksuite.com/open-apis/bitable/v1/apps/${encodeURIComponent(appToken)}/tables/${encodeURIComponent(tableId)}/records`);
    url.searchParams.set('page_size', '500');
    if (pageToken) url.searchParams.set('page_token', pageToken);
    const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const payload = await larkJson(response, 'Lark records API') as { code?: number; msg?: string; data?: { items?: Array<{ fields: Record<string, unknown> }>; has_more?: boolean; page_token?: string } };
    if (!response.ok || payload.code !== 0) throw new Error(`Lark API lỗi (${payload.code ?? response.status}): ${payload.msg || response.statusText || 'Không rõ nguyên nhân.'}`);
    const data = payload.data;
    if (!data) throw new Error('Lark API không trả dữ liệu.');
    records.push(...(data.items || []));
    if (!data.has_more) return records;
    if (!data.page_token || data.page_token === pageToken) throw new Error('Lark phân trang không hợp lệ.');
    pageToken = data.page_token;
  }
  // shortcut: reads at most 10,000 rows, add server-side Lark filtering if the Base grows beyond this.
  throw new Error('Workshop vượt quá giới hạn đồng bộ 10.000 bản ghi.');
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('Origin') || '';
    const allowedOrigins = (env.ALLOWED_ORIGIN || '').split(',').map(value => value.trim()).filter(Boolean);
    if (!origin || !allowedOrigins.includes(origin)) return json({ error: 'Origin không được phép.' }, 403);
    if (request.method === 'OPTIONS') return new Response(null, { headers: {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Max-Age': '86400',
      'Vary': 'Origin',
    } });
    if (request.method !== 'GET') return json({ error: 'Method không được hỗ trợ.' }, 405, origin);
    if (!env.PROXY_ACCESS_KEY || request.headers.get('Authorization') !== `Bearer ${env.PROXY_ACCESS_KEY}`) {
      return json({ error: 'Không có quyền truy cập.' }, 401, origin);
    }
    const workshopId = new URL(request.url).searchParams.get('workshopId')?.trim();
    if (!workshopId) return json({ error: 'Thiếu workshopId.' }, 400, origin);
    try {
      const tokenResponse = await fetch('https://open.larksuite.com/open-apis/auth/v3/tenant_access_token/internal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ app_id: env.APP_ID.trim(), app_secret: env['APP-SECRET'].trim() }),
      });
      const tokenPayload = await larkJson(tokenResponse, 'Lark auth API') as { code?: number; msg?: string; tenant_access_token?: string };
      if (!tokenResponse.ok || tokenPayload.code !== 0 || !tokenPayload.tenant_access_token) throw new Error(`Lark xác thực thất bại (${tokenPayload.code ?? tokenResponse.status}): ${tokenPayload.msg || tokenResponse.statusText || 'Kiểm tra APP_ID và APP-SECRET.'}`);
      const records = await readAllRecords(env, tokenPayload.tenant_access_token);
      const matching = records.filter(({ fields }) => fieldText(fields, 'workshop') === workshopId);
      return json({ workshopId, records: matching.map(({ fields }) => ({
        phone: fieldText(fields, 'phone'),
        studentId: fieldText(fields, 'studentId'),
        name: fieldText(fields, 'name'),
      })) }, 200, origin);
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : 'Không thể đồng bộ dữ liệu.' }, 502, origin);
    }
  },
};
