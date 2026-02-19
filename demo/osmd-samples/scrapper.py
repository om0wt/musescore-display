import os
import time
import requests
from tqdm import tqdm
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options

# --- CONFIG ---
DEMO_URL = "https://opensheetmusicdisplay.github.io/demo/"
DOWNLOAD_DIR = "scores"

os.makedirs(DOWNLOAD_DIR, exist_ok=True)

# --- SETUP SELENIUM (headless) ---
options = Options()
options.add_argument("--headless")
options.add_argument("--disable-gpu")

driver = webdriver.Chrome(options=options)

print("Loading demo page...")
driver.get(DEMO_URL)
time.sleep(3)  # wait for JS to populate dropdown

# Find the score <select> and its <option> elements
select = driver.find_element(By.TAG_NAME, "select")
options = select.find_elements(By.TAG_NAME, "option")

# Extract URLs
urls = []
for opt in options:
    val = opt.get_attribute("value")
    if val and (val.endswith(".xml") or val.endswith(".mxl")):
        urls.append(val)

driver.quit()

# Remove duplicates just in case
urls = list(set(urls))
print(f"Found {len(urls)} score URLs.")

# --- DOWNLOAD FILES ---
for url in tqdm(urls):
    filename = url.split("/")[-1]
    dest = os.path.join(DOWNLOAD_DIR, filename)
    try:
        r = requests.get(url)
        r.raise_for_status()
        with open(dest, "wb") as f:
            f.write(r.content)
    except Exception as e:
        print(f"FAILED to download {url}: {e}")

print("Done!")
