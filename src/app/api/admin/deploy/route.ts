import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

// Vercel API configuration
const VERCEL_TOKEN = process.env.VERCEL_TOKEN || process.env.VERCEL_API_TOKEN;
const VERCEL_PROJECT_ID = process.env.VERCEL_PROJECT_ID;
const VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID;

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('auth_token')?.value ||
                  request.headers.get('authorization')?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const user = await getUserFromToken(token);
    if (!user || !user.is_admin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    if (!VERCEL_TOKEN || !VERCEL_PROJECT_ID) {
      return NextResponse.json({ 
        error: 'Vercel deployment not configured. Please set VERCEL_TOKEN and VERCEL_PROJECT_ID environment variables.' 
      }, { status: 500 });
    }

    // Get the stored environment variables from settings
    const { data: settings } = await supabaseAdmin
      .from('settings')
      .select('*')
      .in('key', ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID', 'JWT_SECRET']);

    const envVars: Record<string, string> = {};
    for (const setting of settings || []) {
      if (setting.value) {
        envVars[setting.key] = setting.value;
      }
    }

    // Update Vercel project environment variables
    if (Object.keys(envVars).length > 0) {
      for (const [key, value] of Object.entries(envVars)) {
        try {
          // First, try to update existing env var
          const existingEnvRes = await fetch(
            `https://api.vercel.com/v9/projects/${VERCEL_PROJECT_ID}/env/${key}?teamId=${VERCEL_TEAM_ID || ''}`,
            {
              method: 'PATCH',
              headers: {
                'Authorization': `Bearer ${VERCEL_TOKEN}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                value: value,
                target: ['production', 'preview', 'development'],
              }),
            }
          );

          // If env var doesn't exist, create it
          if (!existingEnvRes.ok) {
            await fetch(
              `https://api.vercel.com/v9/projects/${VERCEL_PROJECT_ID}/env?teamId=${VERCEL_TEAM_ID || ''}`,
              {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${VERCEL_TOKEN}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  key: key,
                  value: value,
                  type: 'encrypted',
                  target: ['production', 'preview', 'development'],
                }),
              }
            );
          }
        } catch (err) {
          console.error(`Failed to update env var ${key}:`, err);
        }
      }
    }

    // Trigger a new deployment
    const deployRes = await fetch(
      `https://api.vercel.com/v13/deployments?teamId=${VERCEL_TEAM_ID || ''}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${VERCEL_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'telecloud-storage',
          target: 'production',
          gitSource: {
            type: 'github',
            ref: 'main',
            repoId: 1237801250, // telecloud-storage repo ID
          },
        }),
      }
    );

    const deployData = await deployRes.json();

    if (!deployRes.ok) {
      console.error('Deploy error:', deployData);
      return NextResponse.json({ 
        error: deployData.error?.message || 'Failed to trigger deployment' 
      }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      deployment: {
        id: deployData.id,
        url: deployData.url,
        status: deployData.readyState,
      }
    });
  } catch (error) {
    console.error('Deploy error:', error);
    return NextResponse.json({ error: 'Failed to trigger deployment' }, { status: 500 });
  }
}

// Get deployment status
export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('auth_token')?.value ||
                  request.headers.get('authorization')?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const user = await getUserFromToken(token);
    if (!user || !user.is_admin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    if (!VERCEL_TOKEN || !VERCEL_PROJECT_ID) {
      return NextResponse.json({ 
        deployments: [],
        error: 'Vercel not configured'
      });
    }

    // Get recent deployments
    const res = await fetch(
      `https://api.vercel.com/v6/deployments?projectId=${VERCEL_PROJECT_ID}&limit=5&teamId=${VERCEL_TEAM_ID || ''}`,
      {
        headers: {
          'Authorization': `Bearer ${VERCEL_TOKEN}`,
        },
      }
    );

    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json({ deployments: [], error: data.error?.message });
    }

    const deployments = (data.deployments || []).map((d: Record<string, unknown>) => {
      const meta = d.meta as Record<string, string> | undefined;
      return {
        id: d.uid as string,
        url: d.url as string,
        status: d.readyState as string,
        createdAt: d.created as number,
        branch: meta?.githubCommitRef || 'main',
        commit: meta?.githubCommitSha?.substring(0, 7) || '',
        message: meta?.githubCommitMessage || '',
      };
    });

    return NextResponse.json({ deployments });
  } catch (error) {
    console.error('Get deployments error:', error);
    return NextResponse.json({ deployments: [], error: 'Failed to get deployments' });
  }
}
