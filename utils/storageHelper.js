const { bucket } = require("../config/firebase");
const crypto = require("crypto");

/**
 * Uploads a base64 encoded file to Firebase Storage.
 * @param {string} base64String - Data URI string (e.g., 'data:image/jpeg;base64,/9j/4AAQSk...')
 * @param {string} folderPath - The folder path in storage (e.g., 'stock/gate-entries/GE-001')
 * @param {string} filename - The base filename without extension (e.g., 'driverPhoto')
 * @returns {Promise<string|null>} - The Firebase Storage download URL, or null if invalid base64.
 */
async function uploadBase64File(base64String, folderPath, filename) {
  if (!base64String || !base64String.startsWith("data:")) {
    return base64String; 
  }

  try {
       const matches = base64String.match(/^data:([A-Za-z-+\/.]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return null;
    }

    const mimeType = matches[1];
    const base64Data = matches[2];
    
    let ext = "";
    if (mimeType.includes("image/jpeg")) ext = ".jpg";
    else if (mimeType.includes("image/png")) ext = ".png";
    else if (mimeType.includes("video/mp4")) ext = ".mp4";
    else if (mimeType.includes("video/webm")) ext = ".webm";
    else if (mimeType.includes("application/pdf")) ext = ".pdf";
    else if (mimeType.includes("officedocument.spreadsheetml")) ext = ".xlsx";
    else ext = "." + mimeType.split("/")[1];

    const buffer = Buffer.from(base64Data, "base64");
    
    // Check if filename already has an extension
    const hasExtension = filename.includes(".");
    const fullPath = hasExtension ? `${folderPath}/${filename}` : `${folderPath}/${filename}${ext}`;
    
    const file = bucket.file(fullPath);

    const token = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString("hex");

    await file.save(buffer, {
      metadata: {
        contentType: mimeType,
        metadata: {
          firebaseStorageDownloadTokens: token,
        },
      },
    });

    const bucketName = bucket.name;
    const downloadUrl = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(
      fullPath
    )}?alt=media&token=${token}`;

    return downloadUrl;
  } catch (error) {
    console.error(`Firebase Storage Upload Error [${folderPath}/${filename}]:`, error.message);
    console.error("Full error:", error);
    return null; 
  }
}

module.exports = {
  uploadBase64File,
};
