# open csv "C:\Users\spu7n\Downloads\List of every rated level in Geometry Dash - Rated.csv"

file = open(
    "C:/Users/spu7n/Downloads/List of every rated level in Geometry Dash - Rated.csv", "r", encoding="utf8")
lines = file.readlines()
file.close()

extremes = []

for i in range(1, len(lines) - 1):
    lines[i] = lines[i].split(",")
    name = lines[i][0]

    if len(lines[i]) > 4 and lines[i][4] == "ExtreDemon10*":
        extremes.append(name)

# save to file
file = open("C:/Users/spu7n/Downloads/Extremes.txt", "w")
file.write("\n".join(extremes))
file.close()
