import axios from 'axios'

let cachedToken = null
let tokenExpiresAt = 0

export async function getManagementApiToken() {
  const domain = process.env.AUTH0_DOMAIN
  const clientId = process.env.AUTH0_CLIENT_ID
  const clientSecret = process.env.AUTH0_CLIENT_SECRET

  if (!domain || !clientId || !clientSecret) {
    console.warn('⚠️ Auth0 Management API credentials missing in backend environment variables.')
    return null
  }

  // Return cached token if valid
  if (cachedToken && Date.now() < tokenExpiresAt - 60000) {
    return cachedToken
  }

  try {
    const response = await axios.post(`https://${domain}/oauth/token`, {
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
      audience: `https://${domain}/api/v2/`,
    })

    cachedToken = response.data.access_token
    tokenExpiresAt = Date.now() + response.data.expires_in * 1000
    return cachedToken
  } catch (err) {
    console.error('❌ Failed to obtain Auth0 Management API Token:', err.response?.data || err.message)
    return null
  }
}

export async function createAuth0User(studentData) {
  const domain = process.env.AUTH0_DOMAIN
  const token = await getManagementApiToken()

  if (!token) {
    // Development fallback mock ID if Auth0 Management API is not configured in local environment
    console.warn('⚠️ Auth0 Management API unavailable. Falling back to local ID generator.')
    return `auth0|local_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
  }

  try {
    const tempPassword = `Student@${Math.random().toString(36).substring(2, 8)}!`
    const response = await axios.post(
      `https://${domain}/api/v2/users`,
      {
        connection: 'Username-Password-Authentication',
        email: studentData.email,
        username: studentData.username || studentData.email.split('@')[0],
        password: tempPassword,
        name: studentData.name,
        user_metadata: {
          register_number: studentData.registerNumber,
          department: studentData.department,
        },
        app_metadata: {
          role: 'STUDENT',
        },
        email_verified: true,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    )

    return response.data.user_id
  } catch (err) {
    console.error('❌ Error provisioning user in Auth0:', err.response?.data || err.message)
    throw new Error(err.response?.data?.message || 'Failed to create student user in Auth0')
  }
}
