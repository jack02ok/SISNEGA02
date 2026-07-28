export interface FonnteSendParams {
  target: string;
  message: string;
  token?: string;
}

export async function sendFonnteWA({ target, message, token }: FonnteSendParams) {
  try {
    // Format phone number to international 62 if starts with 0
    let cleanTarget = target.trim();
    if (cleanTarget.startsWith('0')) {
      cleanTarget = '62' + cleanTarget.slice(1);
    }
    
    const res = await fetch('/api/fonnte/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        target: cleanTarget,
        message,
        token,
      }),
    });

    const data = await res.json();
    return data;
  } catch (err) {
    console.error("Failed sending Fonnte WA message:", err);
    return { status: false, message: "Network error or server unreachable" };
  }
}
