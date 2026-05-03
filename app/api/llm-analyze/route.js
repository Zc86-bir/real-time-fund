import { NextResponse } from 'next/server';

export async function POST(request) {
  const MIMO_API_KEY = (process.env.MIMO_API_KEY || '').trim();

  if (!MIMO_API_KEY) {
    return NextResponse.json(
      { error: 'MIMO_API_KEY 未配置，请在 .env.local 中设置' },
      { status: 501 }
    );
  }

  const MIMO_BASE_URL = (process.env.MIMO_BASE_URL || 'https://api.xiaomimimo.com/v1').trim();

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '请求体格式错误' }, { status: 400 });
  }

  const { prompt } = body;
  if (!prompt) {
    return NextResponse.json({ error: '缺少 prompt 参数' }, { status: 400 });
  }

  try {
    const response = await fetch(`${MIMO_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${MIMO_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'mimo-v2.5',
        messages: [
          {
            role: 'system',
            content: '你是一位专业的基金投资顾问，擅长分析基金持仓组合并给出投资建议。请用简洁专业的中文回答。',
          },
          { role: 'user', content: prompt },
        ],
        max_tokens: 2000,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      // 仅返回状态码，不泄露上游错误详情
      return NextResponse.json(
        { error: `MIMO API 请求失败: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    return NextResponse.json({ content, model: data.model || 'mimo-v2.5' });
  } catch (e) {
    return NextResponse.json(
      { error: `请求 MIMO API 出错: ${e.message}` },
      { status: 500 }
    );
  }
}
