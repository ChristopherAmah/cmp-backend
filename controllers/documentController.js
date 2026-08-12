import Document from "../models/Document.js";
import Organization from "../models/Organization.js";
import cloudinary from "../config/cloudinary.js";
import https from "https";
import { URL } from "url";

export const getDocuments = async (req, res) => {
  try {
    const {
      organizationId,
      contractId,
      light,
      page,
      limit,
      includeStats,
      search,
      documentType,
    } = req.query;
    let query = {};

    if (organizationId) {
      query.organization = organizationId;
    }

    if (contractId) {
      query.contract = contractId;
    }

    if (documentType) {
      query.documentType = documentType;
    }

    if (search) {
      query.documentName = { $regex: search, $options: "i" };
    }

    const isLight = String(light) === "true";
    const wantsStats = String(includeStats) === "true";
    const pageNum = Math.max(1, Number(page || 1));
    const limitNum = Math.min(500, Math.max(0, Number(limit || 0))); // 0 => no limit

    const findQuery = Document.find(query)
      .populate("organization", "name")
      .populate("contract", "title contractNumber")
      .sort({ createdAt: -1 });

    if (isLight) {
      findQuery.select(
        "documentName documentType organization createdAt startDate expiryDate fileSize fileType cloudinaryUrl"
      );
    } else {
      findQuery
        .populate("uploadedBy", "name email")
        .select(
          "documentName documentType organization uploadedBy createdAt startDate expiryDate fileSize fileType cloudinaryUrl"
        );
    }

    if (limitNum > 0) {
      findQuery.skip((pageNum - 1) * limitNum).limit(limitNum);
    }

    const now = new Date();
    const thirtyDaysFromNow = new Date(
      now.getTime() + 30 * 24 * 60 * 60 * 1000
    );

    const [documents, total, stats] = await Promise.all([
      findQuery.lean(),
      limitNum > 0
        ? Document.countDocuments(query)
        : Promise.resolve(undefined),
      wantsStats
        ? Promise.all([
            Document.countDocuments(query),
            Document.countDocuments({
              ...query,
              expiryDate: { $lt: now },
            }),
            Document.countDocuments({
              ...query,
              expiryDate: { $gte: now, $lt: thirtyDaysFromNow },
            }),
            Document.countDocuments({
              ...query,
              expiryDate: { $gte: now },
            }),
          ]).then(([t, expired, expiringSoon, active]) => ({
            total: t,
            expired,
            expiringSoon,
            active,
          }))
        : Promise.resolve(undefined),
    ]);

    res.status(200).json({
      status: "success",
      data: documents,
      stats,
      meta:
        typeof total === "number"
          ? { page: pageNum, limit: limitNum, total }
          : undefined,
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};

export const getDocument = async (req, res) => {
  try {
    const document = await Document.findById(req.params.id)
      .populate("organization", "name")
      .populate("contract", "title contractNumber")
      .populate("uploadedBy", "name email")
      .lean();

    if (!document) {
      return res.status(404).json({
        status: "error",
        message: "Document not found",
      });
    }

    res.status(200).json({
      status: "success",
      data: document,
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};

export const uploadDocument = async (req, res) => {
  try {
    const {
      documentName,
      documentType,
      organizationId,
      contractId,
      startDate,
      expiryDate,
    } = req.body;

    if (!req.file) {
      return res.status(400).json({
        status: "error",
        message: "Please upload a PDF file",
      });
    }

    // Handle case where organizationId might be an array (due to duplicate FormData append)
    const orgId = Array.isArray(organizationId) 
      ? organizationId[0] 
      : organizationId;

    if (!orgId) {
      return res.status(400).json({
        status: "error",
        message: "Organization ID is required",
      });
    }

    // Verify organization exists
    const organization = await Organization.findById(orgId);
    if (!organization) {
      return res.status(404).json({
        status: "error",
        message: "Organization not found",
      });
    }

    const document = await Document.create({
      documentName,
      documentType: documentType || "Other",
      organization: orgId,
      contract: contractId || null,
      cloudinaryId: req.file.public_id || req.file.filename,
      cloudinaryUrl: req.file.secure_url || req.file.path,
      fileSize: req.file.size || req.file.bytes,
      startDate: startDate || null,
      expiryDate: expiryDate || null,
      uploadedBy: req.user.id,
    });

    const populatedDocument = await Document.findById(document._id)
      .populate("organization", "name")
      .populate("contract", "title contractNumber")
      .populate("uploadedBy", "name email");

    res.status(201).json({
      status: "success",
      data: populatedDocument,
    });
  } catch (error) {
    console.error("Upload Error Details:", error);
    res.status(500).json({
      status: "error",
      message: error.message || "Server Error during upload",
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
};

export const downloadDocument = async (req, res) => {
  try {
    const document = await Document.findById(req.params.id);

    if (!document) {
      return res.status(404).json({
        status: "error",
        message: "Document not found",
      });
    }

    // Redirect to Cloudinary URL for download
    res.redirect(document.cloudinaryUrl);
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};

export const viewDocument = async (req, res) => {
  try {
    const document = await Document.findById(req.params.id);

    if (!document) {
      return res.status(404).json({
        status: "error",
        message: "Document not found",
      });
    }

    if (!document.cloudinaryUrl) {
      return res.status(404).json({
        status: "error",
        message: "Document URL not found",
      });
    }

    // Fetch PDF from Cloudinary and stream it to avoid CORS issues
    return new Promise((resolve) => {
      try {
        const parsedUrl = new URL(document.cloudinaryUrl);
        const options = {
          hostname: parsedUrl.hostname,
          path: parsedUrl.pathname + parsedUrl.search,
          method: "GET",
          headers: {
            "User-Agent": "CMP-Backend/1.0",
          },
        };

        const request = https.get(options, (response) => {
          if (response.statusCode !== 200) {
            if (!res.headersSent) {
              res.status(response.statusCode).json({
                status: "error",
                message: `Failed to fetch PDF: ${response.statusCode}`,
              });
            }
            return resolve();
          }

          // Set headers before piping
          if (!res.headersSent) {
            res.setHeader("Content-Type", "application/pdf");
            res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(document.documentName || 'document.pdf')}"`);
            res.setHeader("Cache-Control", "public, max-age=3600");
          }
          
          // Pipe the response
          response.on("end", () => {
            resolve();
          });
          
          response.on("error", (err) => {
            console.error("Error streaming PDF:", err);
            if (!res.headersSent) {
              res.status(500).json({
                status: "error",
                message: "Error streaming PDF",
              });
            }
            resolve();
          });

          response.pipe(res);
        });

        request.on("error", (error) => {
          console.error("Error fetching from Cloudinary:", error);
          if (!res.headersSent) {
            res.status(500).json({
              status: "error",
              message: "Failed to fetch PDF from storage",
            });
          }
          resolve();
        });

        request.setTimeout(30000, () => {
          request.destroy();
          if (!res.headersSent) {
            res.status(504).json({
              status: "error",
              message: "Request timeout",
            });
          }
          resolve();
        });
      } catch (fetchError) {
        console.error("Error setting up PDF fetch:", fetchError);
        if (!res.headersSent) {
          res.status(500).json({
            status: "error",
            message: "Failed to process PDF request",
          });
        }
        resolve();
      }
    });
  } catch (error) {
    console.error("Error in viewDocument:", error);
    if (!res.headersSent) {
      res.status(500).json({
        status: "error",
        message: error.message,
      });
    }
  }
};

export const deleteDocument = async (req, res) => {
  try {
    const document = await Document.findById(req.params.id);

    if (!document) {
      return res.status(404).json({
        status: "error",
        message: "Document not found",
      });
    }

    // Delete from Cloudinary
    try {
      await cloudinary.uploader.destroy(document.cloudinaryId, {
        resource_type: "raw",
      });
    } catch (cloudinaryError) {
      console.error("Cloudinary delete error:", cloudinaryError);
    }

    // Delete from database
    await Document.findByIdAndDelete(req.params.id);

    res.status(200).json({
      status: "success",
      message: "Document deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};

