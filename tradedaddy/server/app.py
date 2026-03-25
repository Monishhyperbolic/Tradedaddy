from flask import Flask, request, jsonify
from flask_cors import CORS
import os

app = Flask(__name__)
# Allow your frontend domain specifically or use "*" for testing
CORS(app)

@app.route("/api/health")
def health():
    return jsonify({"status": "ok"}), 200

app = app