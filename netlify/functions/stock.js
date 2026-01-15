const axios = require('axios');

exports.handler = async function(event, context) {
    // Only allow POST requests
    if (event.httpMethod !== "POST") {
        return { statusCode: 405, body: "Method Not Allowed" };
    }

    const { itemName, quantity } = JSON.parse(event.body);

    // SECRETS (These will be set in Netlify dashboard)
    const REFRESH_TOKEN = process.env.REFRESH_TOKEN;
    const CLIENT_ID = process.env.CLIENT_ID;
    const CLIENT_SECRET = process.env.CLIENT_SECRET;
    const ORG_ID = process.env.ORG_ID;

    try {
        // 1. Get a fresh Access Token
        const tokenUrl = `https://accounts.zoho.com/oauth/v2/token?refresh_token=${REFRESH_TOKEN}&client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}&grant_type=refresh_token`;
        const tokenRes = await axios.post(tokenUrl);
        const accessToken = tokenRes.data.access_token;

        if (!accessToken) throw new Error("Could not get access token");

        const headers = { 'Authorization': `Zoho-oauthtoken ${accessToken}` };

        // 2. Find Item ID
        const searchUrl = `https://www.zohoapis.com/books/v3/items?organization_id=${ORG_ID}&name=${encodeURIComponent(itemName)}`;
        const searchRes = await axios.get(searchUrl, { headers });
        const item = searchRes.data.items[0];

        if (!item) return { statusCode: 404, body: `Item '${itemName}' not found in Zoho.` };

        // 3. Adjust Stock
        const adjustUrl = `https://www.zohoapis.com/books/v3/inventoryadjustments?organization_id=${ORG_ID}`;
        await axios.post(adjustUrl, {
            date: new Date().toISOString().split('T')[0],
            reason: "Velcrest App Update",
            adjustment_type: "quantity",
            line_items: [{
                item_id: item.item_id,
                quantity_adjusted: quantity,
                adjustment_account_id: process.env.ADJUSTMENT_ACCOUNT_ID 
            }]
        }, { headers });

        return {
            statusCode: 200,
            body: `Updated ${itemName} by ${quantity}`
        };

    } catch (error) {
        console.error(error);
        return { statusCode: 500, body: "Failed to update stock." };
    }
};
