const { uploadBase64File } = require("../utils/storageHelper");
const asyncHandler = require("../utils/asyncHandler");

exports.uploadFile = asyncHandler(async (req, res) => {
  const { base64File, storagePath } = req.body;
  if (!base64File) {
    return res.status(400).json({ success: false, message: "No file provided." });
  }

  // storagePath includes the path and the filename, e.g., projects/isi/abc/123_file.png
  // uploadBase64File signature: uploadBase64File(base64String, folderPath, filename)
  const pathParts = storagePath.split("/");
  const filename = pathParts.pop();
  const folderPath = pathParts.join("/");

  const url = await uploadBase64File(base64File, folderPath, filename);

  res.json({ success: true, url, storagePath });
});
