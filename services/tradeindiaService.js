const axios = require("axios");

exports.fetchTradeIndiaLeads = async () => {
  try {
    const now = new Date();
    const ISTOffset = 330 * 60 * 1000; 
    const ISTTime = new Date(now.getTime() + ISTOffset);
    const todayStr = ISTTime.toISOString().split("T")[0];

    const res = await axios.get("https://www.tradeindia.com/utils/my_inquiry.html", {
      params: {
        userid: process.env.TRADEINDIA_USER_ID,
        profile_id: process.env.TRADEINDIA_PROFILE_ID,
        key: process.env.TRADEINDIA_KEY,
        from_date: todayStr,
        to_date: todayStr,
        limit: 100,
        page_no: 1,
      },
    });

    const leads = res.data?.data || res.data || [];
    return Array.isArray(leads) ? leads : [];
  } catch (err) {
    console.error("TRADEINDIA SERVICE ERROR:", err.message);
    return [];
  }
};