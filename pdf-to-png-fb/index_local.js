const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const express = require("express")
const { promisify } = require('util')
const admin = require('firebase-admin')
const bodyParser = require('body-parser')
const functions = require("firebase-functions")
const { Storage } = require('@google-cloud/storage')
const FileWriter = require('pdf-extractor').FileWriter
const PdfExtractor = require('pdf-extractor').PdfExtractor
const CanvasRenderer = require('pdf-extractor').CanvasRenderer

admin.initializeApp()

const app = express()

const storage = new Storage()

const readdir = promisify(fs.readdir)
const stat = promisify(fs.stat)

app.use(bodyParser.json({ limit: '100mb' }))

class PNGWriter extends FileWriter {
	getFilePathForPage(page) {
		return super.getPagePath(page.pageNumber, 'png');
	}

	writeCanvasPage(page, _, canvas) {
		return this.writeStreamToFile(canvas.pngStream(), this.getFilePathForPage(page))
	}
}

class PNGCanvasRenderer extends CanvasRenderer {
	getWriters(writerOptions) {
		return [new PNGWriter(this.outputDir, writerOptions)];
	}
}

async function* getFiles(directory = '.') {
	for (const file of await readdir(directory)) {
		const fullPath = path.join(directory, file);
		const stats = await stat(fullPath);

		if (stats.isDirectory()) {
			yield* getFiles(fullPath);
		}

		if (stats.isFile()) {
			yield fullPath;
		}
	}
}

app.post("/pdf-to-png", async (req, res) => {
	const { data, filename } = req.body;

	const input = data.split(';base64,').pop();

	const hashSum = crypto.createHash('sha256');
	hashSum.update(data);

	const hex = hashSum.digest('hex');

	const outputDir = `${hex}/`

	const bucket = storage.bucket('gs://pdf-to-png-98491.appspot.com/')

	const [files] = await bucket.getFiles({ prefix: outputDir });

	if (files.length > 0) {
		console.log('Exist')
		console.log(files.flatMap(item => item.metadata?.mediaLink))
		return res.status(200).send(files.flatMap(item => item.metadata?.mediaLink))
	}
	else {
		console.log('Need to create')

		if (!fs.existsSync(`../${outputDir}`)) {
			fs.mkdirSync(`../${outputDir}`, { recursive: true });
		}

		fs.writeFileSync(`../${outputDir}${filename}`, input, { encoding: 'base64' }, (e) => {
			console.log('PDF save error', e)
			return res.status(400).send([])
		})

		const pdfExtractor = new PdfExtractor(`../${outputDir}`, {
			renderers: [
				new PNGCanvasRenderer(`../${outputDir}`, (width, height) => {
					if (width > height) {
						return 1100 / width;
					}
					return 800 / width;
				}, {})
			],
		})

		pdfExtractor.parse(`../${outputDir}${filename}`)
			.then(async () => {
				const images = []
				for await (const filePath of getFiles(`../${outputDir}`)) {
					if (filePath.includes('.png')) {
						try {
							const dirname = path.dirname(`../${outputDir}`);
							const destination = path.relative(dirname, filePath);

							const res = await bucket.upload(filePath, { destination });

							console.log(`Successfully uploaded: ${filePath}`);
							images.push(res[0].metadata?.mediaLink)
						} catch (e) {
							console.error(`Error uploading ${filePath}:`, e);
						}
					}
				}

				fs.rmSync(`../${outputDir}`, { recursive: true, force: true })

				console.log(images)
				return res.status(200).send(images)
			}).catch(function (err) {
				console.error('Error: ' + err);
				return res.status(400).send([])
			})
	}
})

exports.convertPDFtoPNG = functions.https.onRequest(app);
