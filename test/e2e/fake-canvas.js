import { createServer } from 'node:https';

const PDF = Buffer.from('%PDF-1.4\n% not really a pdf\n');

export const COURSE_ID = '171357';
export const COURSE_NAME = 'ECON 1011A: Intermediate Microeconomics';

const COURSE_PAGE = `<!doctype html>
<html><head><title>Course Files: ${COURSE_NAME}</title></head><body>
<nav id="breadcrumbs"><ul>
<li><a href="/"><span>Dashboard</span></a></li>
<li><a href="/courses/${COURSE_ID}"><span class="ellipsible">${COURSE_NAME}</span></a></li>
<li><a href="/courses/${COURSE_ID}/files"><span>Files</span></a></li>
</ul></nav>
<h1>Files</h1>
</body></html>`;

// Stands in for Canvas. Chrome is started with --host-resolver-rules so that both
// canvas.harvard.edu and localhost resolve to this server; the port is whatever
// the OS hands out. Routes:
//
//   /courses/<id>/files                 course page with a Canvas-style breadcrumb
//   /courses/<id>/files/<n>/download    redirects to the "CDN" on localhost, as Canvas does
//   /files/<n>/download                 attachment whose URL carries no course id
//   /cdn/<name>, /<name>.pdf            attachments
export function startFakeCanvas({ cert, key }) {
  const server = createServer({ cert, key }, (request, response) => {
    const { pathname } = new URL(request.url, 'https://localhost');

    if (/^\/courses\/\d+\/files\/\d+\/download$/.test(pathname)) {
      response.writeHead(302, {
        Location: `https://localhost:${server.address().port}/cdn/lecture4.pdf`,
      });
      response.end();
    } else if (/^\/files\/\d+\/download$/.test(pathname)) {
      attachment(response, 'pset3.pdf');
    } else if (pathname.startsWith('/cdn/') || pathname.endsWith('.pdf')) {
      attachment(response, pathname.slice(pathname.lastIndexOf('/') + 1));
    } else if (/^\/courses\/\d+/.test(pathname)) {
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      response.end(COURSE_PAGE);
    } else {
      response.writeHead(404);
      response.end();
    }
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

function attachment(response, filename) {
  response.writeHead(200, {
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename="${filename}"`,
    'Content-Length': PDF.length,
  });
  response.end(PDF);
}
