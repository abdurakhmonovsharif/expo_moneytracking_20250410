#!/bin/bash
#
# Export expo script

ACCOUNT_NAME="Thirteendev"
PROJECT_NAME="Moneytracking"

rm -rf ./dist/
# Execute EAS update

npx eas update --auto --non-interactive --json > ./landing/preview.json

cp -r ./landing/* ./dist

cd ./dist/

# Generate QR codes for the update
# Read the JSON file and iterate over each update
jq -c '.[]' preview.json | while read -r update; do
  # Extract the id and platform from the JSON object
  id=$(echo $update | jq -r '.id')
  platform=$(echo $update | jq -r '.platform')
  
  # Generate the QR code using the id and platform
  if [ "$platform" == "android" ]; then
    qrencode -s 10 -l L -v 1 -o "./img/android.png" "exp://u.expo.dev/update/${id}" --foreground=304FFB
  elif [ "$platform" == "ios" ]; then
    qrencode -s 10 -l L -v 1 -o "./img/ios.png" "exp://u.expo.dev/update/${id}" --foreground=1A202C
  fi
done

git init
git add -A
git commit -m "Deploy"
git remote add origin https://github.com/${ACCOUNT_NAME}/${PROJECT_NAME}.git
git push origin master --force

echo "QR codes generated successfully."