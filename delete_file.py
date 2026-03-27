import requests

url = "https://openapi.jieshuo.cn/v2/files/list?page=1&page_size=100&order_by=file_size&order=desc&search="

payload={}
headers = {
   'app-key': 'grid_9OGNTGX73feXcyzatLwMCBdFxPWhNPBe'
}

response = requests.request("GET", url, headers=headers, data=payload)

files = response.json()['data']['items']

for file in files:
    url = f"https://openapi.jieshuo.cn/v2/files/user/files/{file['file_id']}"

    payload={}
    headers = {
    'app-key': 'grid_9OGNTGX73feXcyzatLwMCBdFxPWhNPBe'
    }

    response = requests.request("DELETE", url, headers=headers, data=payload)

    print(response.json())
