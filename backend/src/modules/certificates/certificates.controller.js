import { createCertificate, getCertificate, listCertificates } from "./certificates.service.js";

export async function listCertificatesHandler(req, res, next) {
  try {
    res.json({ items: await listCertificates(req.query) });
  } catch (error) {
    next(error);
  }
}

export async function getCertificateHandler(req, res, next) {
  try {
    res.json({ item: await getCertificate(req.params.id) });
  } catch (error) {
    next(error);
  }
}

export async function createCertificateHandler(req, res, next) {
  try {
    const certificate = await createCertificate(req.body, req.user.sub);
    res.status(201).json({ item: certificate, message: "Medical certificate saved successfully." });
  } catch (error) {
    next(error);
  }
}
