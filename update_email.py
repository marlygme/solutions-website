import os

def replace_email_in_files(old_email, new_email, directory="."):
    """
    Finds and replaces an email address in all HTML files within a directory.
    """
    count = 0
    # Walk through the directory and its subdirectories
    for root, _, files in os.walk(directory):
        for filename in files:
            # Check if the file is an HTML file
            if filename.endswith(".html"):
                filepath = os.path.join(root, filename)
                try:
                    # Read the file content
                    with open(filepath, 'r', encoding='utf-8') as file:
                        content = file.read()

                    # Replace the old email with the new one
                    if old_email in content:
                        new_content = content.replace(old_email, new_email)

                        # Write the updated content back to the file
                        with open(filepath, 'w', encoding='utf-8') as file:
                            file.write(new_content)
                        
                        print(f"Updated: {filepath}")
                        count += 1
                except Exception as e:
                    print(f"Error processing {filepath}: {e}")

    print(f"\nFinished. Replaced email in {count} files.")


# Define the email addresses to replace
OLD_EMAIL = "contact@marlyg.com"
NEW_EMAIL = "contact@marlyg.net"

# Run the script
if __name__ == "__main__":
    replace_email_in_files(OLD_EMAIL, NEW_EMAIL)
