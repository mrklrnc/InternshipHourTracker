# Build stage
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
ARG BUILD_CONFIGURATION=Release
WORKDIR /src
COPY ["InternshipHoursTracker/InternshipHoursTracker.csproj", "InternshipHoursTracker/"]
RUN dotnet restore "./InternshipHoursTracker/InternshipHoursTracker.csproj"
COPY . .
WORKDIR "/src/InternshipHoursTracker"
RUN dotnet publish "./InternshipHoursTracker.csproj" -c $BUILD_CONFIGURATION -o /app/publish /p:UseAppHost=false

# Runtime stage
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app
EXPOSE 8080
ENV ASPNETCORE_URLS=http://+:8080
COPY --from=build /app/publish .
ENTRYPOINT ["dotnet", "InternshipHoursTracker.dll"]

