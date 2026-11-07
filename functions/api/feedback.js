/**
 * Cloudflare Pages Function: /api/feedback
 * Receives peer feedback submissions on the web deployment.
 */

export async function onRequestPost({ request }) {
  try {
    const contentType = request.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return new Response(JSON.stringify({ error: 'Expected application/json' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const payload = await request.json();

    if (!payload || typeof payload !== 'object') {
      return new Response(JSON.stringify({ error: 'Invalid payload' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const comments = String(payload.comments || '').trim();
    if (!comments || comments.length > 3000) {
      return new Response(JSON.stringify({ error: 'Comments required (max 3000 characters)' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const rating = Number(payload.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return new Response(JSON.stringify({ error: 'Rating must be an integer between 1 and 5' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Log feedback for dashboard review
    console.log('[Wordloom Peer Feedback]:', {
      id: payload.id,
      category: payload.category,
      rating,
      role: payload.roleOrContext,
      comments: comments.slice(0, 100),
      submittedAt: payload.submittedAt
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Feedback received with gratitude.',
        id: payload.id
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store'
        }
      }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Server error processing feedback' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400'
    }
  });
}

