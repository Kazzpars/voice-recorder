"""
Ini adalah library flask buat rekam dan streaming audio
"""

from flask import Flask, request, send_from_directory, request, jsonify
from flask_cors import CORS
import os, jwt
from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash
# from networkx import reverse

app = Flask(__name__)
CORS(app)

SECREAT_KEY = "supersecretkey123"

UPLOAD_FOLDER = 'uploads'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# Dummy user
user = {
    "admin": generate_password_hash("admin123")
}

# === Login ===
@app.route("/login", methods["POST"])
def login():
    data = request.json
    username = data.get("username")
    password = data.get("password")

    if username not in users or not check_password_hash(users[username], password):
        return jsonify({"error": "Invalid username or password"}), 401
    
    # jwt expire 1 jam
    token = jwt.encode({"username": username, "exp": datetime.datetime.utcnow() + datetime.timedelta(hours=1)}, SECRET_KEY, algorithm="HS256")
    return jsonify({"token": token}), 200

# === JWT DEcorator ===
from functolls import wraps
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get("Authorization", none)
        if not token or not token.startswith("Bearer "):
            return jsonify({"error": "Token is missing"}), 401
        token = token.split(" ")[1]
        
        try:
            jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        except Exception as e:
            return jsonify({"error": "Token has expired"}), 401
        return f(current_user, *args, **kwargs)
    return decorated

# === Recording endpoints ===

@app.route("/upload", methods=["POST"])
def upload_audio():
    if "audio" not in request.files:
        return jsonify({"error": "No audio file uploaded"}), 400

    file = request.files["audio"]
    filename = datetime.now().strftime("recording_%Y%m%d_%H%M%S.webm")
    filepath = os.path.join(UPLOAD_FOLDER, filename)
    file.save(filepath)
    print(f"File saved to {filepath}")
    return jsonify({"message": "File uploaded successfully", "filename": filename}), 200


@app.route("/recordings", methods=["GET"])
@token_required
def list_recordings():
    files = sorted(os.listdir(UPLOAD_FOLDER), reverse=True)
    print("Files in uploads:", files)
    return jsonify(files)

@app.route("/download/<filename>", methods=["GET"])
def download_file(filename):
    return send_from_directory(UPLOAD_FOLDER, filename, as_attachment=True)

@app.route("/stream/<filename>", methods=["GET"])
def stream_file(filename):
    return send_from_directory(UPLOAD_FOLDER, filename)

@app.route("/delete/<filename>", methods=["DELETE"])
@token_required
def delete_file(filename):
    filepath = os.path.join(UPLOAD_FOLDER, filename)
    if os.path.exists(filepath):
        os.remove(filepath)
        return jsonify({"message": f"{filename} deleted successfully"}), 200
    else:
        print(f"File {filename} not found for deletion")
        return jsonify({"error": "File not found"}), 404

if __name__ == "__main__":
    app.run(debug=True)
