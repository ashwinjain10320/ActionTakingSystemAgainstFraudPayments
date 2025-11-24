import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { prisma } from '../lib/prisma';

const router = Router();

/**
 * GET /api/kb/search?q=
 * Search knowledge base documents
 */
router.get(
  '/search',
  asyncHandler(async (req, res) => {
    const query = req.query.q as string;

    if (!query) {
      return res.json({ results: [] });
    }

    // Search KB docs by title or content
    const docs = await prisma.kbDoc.findMany({
      where: {
        OR: [
          { title: { contains: query, mode: 'insensitive' } },
          { contentText: { contains: query, mode: 'insensitive' } },
        ],
      },
      take: 10,
    });

    const results = docs.map(doc => ({
      docId: doc.id,
      title: doc.title,
      anchor: doc.anchor,
      extract: doc.contentText.slice(0, 200) + '...',
    }));

    return res.json({ results });
  })
);

export const kbRouter = router;
